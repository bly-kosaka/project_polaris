import {
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  PrismaUploadedAccessLogRepository,
  persistUploadedAccessLog,
} from '@polaris/db';
import { enqueueAnalyzerJob } from '@polaris/queue';
import { buildRawLogStorageKey } from '@polaris/storage';
import type { FastifyInstance } from 'fastify';
import type { ApiDeps } from '../deps.js';

export function registerAnalysesRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.post<{ Params: { projectId: string } }>('/projects/:projectId/analyses', async (req, reply) => {
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: req.params.projectId });
    return reply.code(201).send({ analysisId: analysis.id, status: analysis.status });
  });

  app.post<{ Params: { analysisId: string } }>('/analyses/:analysisId/upload', async (req, reply) => {
    const { analysisId } = req.params;
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);

    const analysis = await analysisRepository.findById(analysisId);
    if (analysis === null) {
      return reply.code(404).send({ error: 'ANALYSIS_NOT_FOUND' });
    }
    if (analysis.status !== 'created') {
      return reply.code(409).send({ error: 'ANALYSIS_NOT_IN_CREATED_STATE' });
    }

    const existingUpload = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    if (existingUpload !== null) {
      return reply.code(409).send({ error: 'UPLOAD_ALREADY_EXISTS' });
    }

    // Streamed size-limit check — Busboy aborts the source stream once
    // `fileSize` is exceeded rather than reading past it
    // (35_Sprint_4_Plan_Review.md's oversized-upload no-residue requirement, T-08).
    const file = await req.file({ limits: { fileSize: deps.maxUploadBytes } });
    if (file === undefined) {
      return reply.code(400).send({ error: 'FILE_REQUIRED' });
    }

    const storageKey = buildRawLogStorageKey(analysisId);

    try {
      await deps.storage.putObject({ key: storageKey, body: file.file, contentType: file.mimetype });
    } catch {
      // Storage Put failed before anything was persisted — Analysis stays
      // 'created', nothing to compensate (34_Development_Setup_and_Fourth_Sprint.md §23).
      return reply.code(502).send({ error: 'STORAGE_PUT_FAILED' });
    }

    if (file.file.truncated) {
      await bestEffortDelete(deps, storageKey);
      return reply.code(413).send({ error: 'FILE_TOO_LARGE' });
    }
    if (file.file.bytesRead === 0) {
      await bestEffortDelete(deps, storageKey);
      return reply.code(400).send({ error: 'FILE_EMPTY' });
    }

    const expiresAt = new Date(Date.now() + deps.rawLogRetentionHours * 60 * 60 * 1000).toISOString();

    let persisted;
    try {
      persisted = await persistUploadedAccessLog(deps.prisma, {
        analysisId,
        originalFileName: file.filename,
        sizeBytes: file.file.bytesRead,
        mimeType: file.mimetype,
        storageKey,
        expiresAt,
      });
    } catch {
      // Transaction failed after a successful Storage Put — best-effort
      // compensating delete, Analysis stays 'created' (F-04, T-09).
      await bestEffortDelete(deps, storageKey);
      return reply.code(500).send({ error: 'UPLOAD_PERSIST_FAILED' });
    }

    try {
      await enqueueAnalyzerJob(deps.analyzerQueue, analysisId);
    } catch {
      // Enqueue failure after a successful persist — Analysis stays
      // 'uploaded', a recoverable state (F-02/T-10); do not advance further
      // and do not fail the request, since the upload itself succeeded.
      return reply.code(202).send({ analysisId, status: persisted.analysis.status, enqueueFailed: true });
    }

    return reply.code(202).send({ analysisId, status: persisted.analysis.status });
  });

  app.get<{ Params: { analysisId: string } }>('/analyses/:analysisId', async (req, reply) => {
    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(req.params.analysisId);
    if (analysis === null) {
      return reply.code(404).send({ error: 'ANALYSIS_NOT_FOUND' });
    }
    return reply.send(analysis);
  });

  app.get<{ Params: { analysisId: string } }>('/analyses/:analysisId/observations', async (req, reply) => {
    // Availability is decided by ObservationSetRecord existence, not
    // Analysis.status — a future `completed` status must still serve it
    // (35_Sprint_4_Plan_Review.md §27).
    const observationSetRecord = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(
      req.params.analysisId,
    );
    if (observationSetRecord === null) {
      return reply.code(404).send({ error: 'OBSERVATION_SET_NOT_READY' });
    }
    return reply.send(observationSetRecord.data);
  });
}

async function bestEffortDelete(deps: ApiDeps, key: string): Promise<void> {
  try {
    await deps.storage.deleteObject(key);
  } catch {
    // Best-effort only — never throw Raw Log content into an error log
    // trying to report this (34_Development_Setup_and_Fourth_Sprint.md §24/§68).
  }
}
