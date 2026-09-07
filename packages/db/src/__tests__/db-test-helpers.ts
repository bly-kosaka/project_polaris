import { randomUUID } from 'node:crypto';
import { analyzeAccessLog, type ObservationSet } from '@polaris/analyzer';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';

/**
 * Deletes all rows in FK-safe order. Safe to share across every test file's
 * `beforeEach` ONLY because file-level parallelism is disabled repo-wide
 * (F-04, root vitest.config.ts) — otherwise one file's cleanup could wipe
 * another file's in-progress data.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.aIExplanationRecord.deleteMany();
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.projectKnownInformation.deleteMany();
  await prisma.project.deleteMany();
  await prisma.account.deleteMany();
}

/**
 * A real Account row for tests that only need `Project.ownerAccountId` to
 * satisfy the FK (`onDelete: Restrict`) — not an Authorization test itself.
 * Auth-focused tests use `apps/api`'s `FakeAuthAdapter` + Lazy Provisioning
 * instead of creating Accounts directly (Sprint 7).
 */
export async function createTestAccount(prisma: PrismaClient): Promise<{ id: string }> {
  const account = await prisma.account.create({
    data: { authProvider: 'clerk', authSubject: `test-subject-${randomUUID()}`, emailVerified: true },
  });
  return { id: account.id };
}

async function* linesFrom(rawLines: string[]): AsyncGenerator<string> {
  for (const line of rawLines) yield line;
}

const SAMPLE_LOG_LINES = [
  '192.0.2.10 - - [10/Oct/2023:17:00:00 +0000] "GET /popular.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
  '192.0.2.10 - - [10/Oct/2023:17:00:30 +0000] "GET /popular.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
  '198.51.100.20 - - [10/Oct/2023:17:01:00 +0000] "GET /wp-login.php HTTP/1.1" 200 512 "-" "Mozilla/5.0 (X11; Linux x86_64)"',
  '198.51.100.20 - - [10/Oct/2023:17:01:10 +0000] "POST /wp-login.php HTTP/1.1" 200 512 "-" "Mozilla/5.0 (X11; Linux x86_64)"',
  '203.0.113.30 - - [10/Oct/2023:17:02:00 +0000] "GET /search?q=polaris&token=abc123 HTTP/1.1" 200 2048 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"',
  '203.0.113.31 - - [10/Oct/2023:17:03:00 +0000] "GET /missing.html HTTP/1.1" 404 209 "-" "curl/8.0"',
];

/**
 * Runs the real analyzeAccessLog() pipeline against a small in-memory
 * sample log, so persistence tests exercise a genuine ObservationSet rather
 * than hand-rolled JSON that could drift from the real shape.
 */
export async function buildValidObservationSet(): Promise<ObservationSet> {
  const result = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES));
  if (result.analyzerStatus === 'failed') {
    throw new Error(`buildValidObservationSet: analyzer returned failed (${result.errorCode})`);
  }
  return result.observationSet;
}

/**
 * Creates a Project and an Analysis advanced to `analyzing` via the real
 * production repository transitions (created -> uploaded -> analyzing) —
 * a valid pre-state for the analyzer_result_ready transition, built without
 * adding any created->analyzing shortcut to the production repository
 * (32_Sprint_3_Plan_Review.md §14).
 */
export async function createAnalysisInAnalyzingState(prisma: PrismaClient): Promise<{
  projectId: string;
  analysisId: string;
}> {
  const account = await createTestAccount(prisma);
  const project = await new PrismaProjectRepository(prisma).create({
    name: 'Persistence Test Project',
    ownerAccountId: account.id,
  });
  const analysisRepository = new PrismaAnalysisRepository(prisma);
  const created = await analysisRepository.create({ projectId: project.id });
  await analysisRepository.updateStatus(created.id, 'uploaded');
  await analysisRepository.updateStatus(created.id, 'analyzing');
  return { projectId: project.id, analysisId: created.id };
}
