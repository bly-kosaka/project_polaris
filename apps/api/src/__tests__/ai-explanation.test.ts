import { PrismaAIExplanationRepository, PrismaAnalysisRepository, PrismaProjectRepository, persistAiExplanationFailure } from '@polaris/db';
import { AI_EXPLANATION_QUEUE, buildAiExplanationJobId, createWorkerConnection } from '@polaris/queue';
import type { FastifyInstance } from 'fastify';
import { Worker } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { buildApiDeps, createAnalysisReadyForAiExplanation, resetDatabase } from './api-test-helpers.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';

function canned(groupId = 'path:whatever') {
  return {
    summary: 'summary',
    overallUrgency: { level: 'normal' as const, reason: 'reason', references: [{ groupId }], limitations: [] },
    findings: [
      {
        id: 'finding-1',
        title: 'title',
        observation: 'observation',
        nextChecks: ['check something'],
        references: [{ groupId }],
      },
    ],
    overallNotes: [],
    dataLimitations: [],
  };
}

describe('ai-explanation routes', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
    app = await buildServer(deps);
  });

  afterAll(async () => {
    await app.close();
    await deps.close();
  });

  describe('GET /analyses/:analysisId/explanation', () => {
    it('returns 404 ANALYSIS_NOT_FOUND for an unknown Analysis', async () => {
      const response = await app.inject({ method: 'GET', url: '/analyses/nonexistent-id/explanation' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: 'ANALYSIS_NOT_FOUND', message: expect.any(String) } });
    });

    it('returns 404 AI_EXPLANATION_NOT_READY before a record exists (covers not_requested/queued/running)', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/explanation` });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: 'AI_EXPLANATION_NOT_READY', message: expect.any(String) } });
    });

    it('returns 409 AI_EXPLANATION_FAILED for a terminal AI failure, never a generic not-ready', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      await persistAiExplanationFailure(deps.prisma, { analysisId });

      const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/explanation` });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: { code: 'AI_EXPLANATION_FAILED', message: expect.any(String) } });
    });

    it('returns 200 with an AIExplanationDetailDto, never the raw prompt/response', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      await new PrismaAIExplanationRepository(deps.prisma).create({
        analysisId,
        schemaVersion: '1.0.0',
        promptVersion: 'initial-explanation-v1',
        provider: 'openai',
        model: 'fake-model',
        data: canned(),
      });

      const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/explanation` });
      expect(response.statusCode).toBe(200);
      const dto = response.json();
      expect(dto).toMatchObject({
        summary: 'summary',
        provider: 'openai',
        model: 'fake-model',
        promptVersion: 'initial-explanation-v1',
      });
      expect(dto.findings).toHaveLength(1);
      expect(typeof dto.createdAt).toBe('string');
      expect(dto).not.toHaveProperty('systemPrompt');
      expect(dto).not.toHaveProperty('userPrompt');
      expect(dto).not.toHaveProperty('providerResponseId');
    });
  });

  describe('POST /analyses/:analysisId/explanation/retry', () => {
    it('returns 404 ANALYSIS_NOT_FOUND for an unknown Analysis', async () => {
      const response = await app.inject({ method: 'POST', url: '/analyses/nonexistent-id/explanation/retry' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: 'ANALYSIS_NOT_FOUND', message: expect.any(String) } });
    });

    it('returns 409 OBSERVATION_SET_NOT_READY before the Analyzer has produced an ObservationSet', async () => {
      const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Retry Precondition Test' });
      const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });

      const response = await app.inject({ method: 'POST', url: `/analyses/${analysis.id}/explanation/retry` });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: { code: 'OBSERVATION_SET_NOT_READY', message: expect.any(String) } });
    });

    it('returns 409 AI_EXPLANATION_ALREADY_EXISTS when a record already exists — Sprint 6 never regenerates a success', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      await new PrismaAIExplanationRepository(deps.prisma).create({
        analysisId,
        schemaVersion: '1.0.0',
        promptVersion: 'initial-explanation-v1',
        provider: 'openai',
        model: 'fake-model',
        data: canned(),
      });

      const response = await app.inject({ method: 'POST', url: `/analyses/${analysisId}/explanation/retry` });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: { code: 'AI_EXPLANATION_ALREADY_EXISTS', message: expect.any(String) } });
    });

    it('M-01 (48_Sprint_6_Final_ReReview.md): recovers an Analysis stuck at aiStatus=not_requested with no Queue job at all, without forcing status to completed', async () => {
      // createAnalysisReadyForAiExplanation never calls
      // scheduleInitialAiExplanation, so this is naturally the exact stuck
      // state M-01 describes: the initial AI enqueue never happened at all
      // (e.g. a Redis outage at the moment persistAnalyzerSuccess committed).
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
      const before = await analysisRepository.findById(analysisId);
      expect(before?.status).toBe('analyzer_result_ready');
      expect(before?.aiStatus).toBe('not_requested');

      const response = await app.inject({ method: 'POST', url: `/analyses/${analysisId}/explanation/retry` });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'enqueued' });

      const after = await analysisRepository.findById(analysisId);
      // A hardcoded 'completed' CAS anchor would have silently no-op'd here
      // (the row is still at 'analyzer_result_ready') — the anchor must be
      // the Analysis's own current status, not an assumption about it.
      expect(after?.status).toBe('analyzer_result_ready');
      expect(after?.aiStatus).toBe('queued');

      const job = await deps.aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
      expect(job).toBeDefined();
    });

    it('T-AI-03 (API half): a terminal AI failure with no Queue job enqueues a fresh job and reconciles aiStatus to queued, leaving status at completed', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
      // A terminal AI failure always leaves Analysis.status at 'completed'
      // (never 'failed', §8/§93) — reached via the real persist function,
      // matching production (analyzer_result_ready -> completed is a legal
      // direct transition, packages/db/src/status-transition.ts).
      await persistAiExplanationFailure(deps.prisma, { analysisId });

      const response = await app.inject({ method: 'POST', url: `/analyses/${analysisId}/explanation/retry` });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'enqueued' });

      const analysis = await analysisRepository.findById(analysisId);
      expect(analysis?.status).toBe('completed');
      expect(analysis?.aiStatus).toBe('queued');

      const job = await deps.aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
      expect(job).toBeDefined();
    });

    it('T-AI-06 (API half, F-05): reconciles aiStatus to queued even when the Queue already had a waiting job the DB never learned about', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
      await analysisRepository.updateStatus(analysisId, 'completed', { aiStatus: 'failed' });

      // Simulate the drift directly: a job is already sitting in the Queue
      // (e.g. from an earlier reconciliation attempt whose own DB write
      // failed), but Analysis.aiStatus is still stuck at 'failed'.
      await deps.aiExplanationQueue.add('ai-explanation', { analysisId }, { jobId: buildAiExplanationJobId(analysisId) });

      const response = await app.inject({ method: 'POST', url: `/analyses/${analysisId}/explanation/retry` });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'already_queued' });

      const analysis = await analysisRepository.findById(analysisId);
      expect(analysis?.status).toBe('completed');
      expect(analysis?.aiStatus).toBe('queued'); // reconciled, not trusted at face value
    });

    it('reports already_running and writes nothing to the DB when the Worker already has the job active', async () => {
      const { analysisId } = await createAnalysisReadyForAiExplanation(deps);
      const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
      await analysisRepository.updateStatus(analysisId, 'explaining', { aiStatus: 'running' });

      const workerConnection = createWorkerConnection(REDIS_URL);
      const worker = new Worker(
        AI_EXPLANATION_QUEUE,
        async () => new Promise((resolve) => setTimeout(resolve, 3000)),
        { connection: workerConnection, concurrency: 1 },
      );
      try {
        await worker.waitUntilReady();
        await deps.aiExplanationQueue.add('ai-explanation', { analysisId }, { jobId: buildAiExplanationJobId(analysisId) });

        const deadline = Date.now() + 5000;
        let state: string | undefined;
        while (Date.now() < deadline && state !== 'active') {
          const job = await deps.aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
          state = await job?.getState();
          if (state !== 'active') await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(state).toBe('active');

        const response = await app.inject({ method: 'POST', url: `/analyses/${analysisId}/explanation/retry` });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: 'already_running' });

        const analysis = await analysisRepository.findById(analysisId);
        expect(analysis?.status).toBe('explaining'); // untouched
        expect(analysis?.aiStatus).toBe('running'); // untouched
      } finally {
        await worker.close();
        workerConnection.disconnect();
      }
    }, 15000);
  });
});
