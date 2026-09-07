/**
 * Manual AI Explanation quality/latency benchmark
 * (44_Development_Setup_and_Sixth_Sprint.md §105-107).
 *
 * NEVER run in CI — this is the one place in the repo that calls a real
 * OpenAI API. Requires a real OPENAI_API_KEY/OPENAI_MODEL in the
 * environment (or .env, auto-loaded below); exits with a clear error if
 * either is missing rather than silently skipping.
 *
 * Run (after `yarn build:backend`, since this imports the built
 * `@polaris/ai`/`@polaris/analyzer` packages):
 *
 *   npx tsx scripts/ai-benchmark.ts
 *
 * or, once dependencies are installed:
 *
 *   yarn ai-benchmark
 *
 * Runs the 3 Golden Explanation Fixtures required by §105 (WordPress login
 * path + POST / many 404s from one IP / API 500 responses) against the real
 * OpenAIResponsesAdapter, and reports the objectively measurable §107
 * metrics for each: Grounding Pass, Reference Validity, Latency, Input/
 * Output/Total Tokens. §107's remaining metrics (Overclaim Rate, Limitation
 * Quality, Next Check Quality, Japanese Readability) require human
 * judgment — the full summary/findings/limitations/nextChecks text is
 * printed and saved so a reviewer can assess those by hand.
 *
 * Deliberately simple / provider-agnostic at the harness level: `runFixture`
 * only depends on the `AIProvider` interface, never `OpenAIResponsesAdapter`
 * directly — adding a second Provider later is a matter of building a
 * different adapter via `selectProvider()`, not rewriting this file.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { analyzeAccessLog } from '@polaris/analyzer';
import type { ObservationSet } from '@polaris/analyzer';
import {
  aiExplanationModelOutputSchema,
  assignFindingIds,
  buildInitialExplanationPrompt,
  collectObservationGroupIds,
  GroundingValidationError,
  selectProvider,
  validateGrounding,
} from '@polaris/ai';
import type { AIExplanationInput, AIExplanationResult, AIProvider } from '@polaris/ai';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Golden Explanation Fixtures (md/44 §105) — real access-log lines run
// through the real analyzeAccessLog() pipeline, same "prefer real
// production code over hand-rolled fixtures" precedent as
// packages/db/src/__tests__/db-test-helpers.ts's buildValidObservationSet().
// ---------------------------------------------------------------------------

interface GoldenFixture {
  id: string;
  label: string;
  lines: string[];
}

function timestamp(offsetSeconds: number): string {
  const base = Date.UTC(2026, 0, 15, 12, 0, 0);
  const d = new Date(base + offsetSeconds * 1000);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `[${day}/${month}/${year}:${hh}:${mm}:${ss} +0000]`;
}

function combinedLogLine(
  ip: string,
  offsetSeconds: number,
  method: string,
  pathAndQuery: string,
  status: number,
  bytes: number,
  referrer: string,
  userAgent: string,
): string {
  return `${ip} - - ${timestamp(offsetSeconds)} "${method} ${pathAndQuery} HTTP/1.1" ${status} ${bytes} "${referrer}" "${userAgent}"`;
}

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';

function fixtureA_WordPressLoginPost(): GoldenFixture {
  const lines: string[] = [];
  // Ordinary browsing traffic, for realism.
  lines.push(combinedLogLine('192.0.2.10', 0, 'GET', '/', 200, 4200, '-', UA_DESKTOP));
  lines.push(combinedLogLine('192.0.2.10', 2, 'GET', '/about.html', 200, 1800, 'https://example.com/', UA_DESKTOP));
  // Repeated POSTs to /wp-login.php from a small number of source IPs.
  const ips = ['198.51.100.20', '198.51.100.21', '198.51.100.22'];
  for (let i = 0; i < 12; i += 1) {
    const ip = ips[i % ips.length]!;
    const status = i % 5 === 0 ? 200 : 401;
    lines.push(combinedLogLine(ip, 10 + i * 3, 'POST', '/wp-login.php', status, 1024, '-', UA_DESKTOP));
  }
  lines.push(combinedLogLine('203.0.113.5', 90, 'GET', '/wp-login.php', 200, 2048, '-', UA_MOBILE));
  return { id: 'A', label: 'WordPress login path + POST', lines };
}

function fixtureB_ManyNotFoundFromOneIp(): GoldenFixture {
  const lines: string[] = [];
  lines.push(combinedLogLine('192.0.2.11', 0, 'GET', '/', 200, 4200, '-', UA_DESKTOP));
  lines.push(combinedLogLine('192.0.2.12', 2, 'GET', '/products', 200, 3100, '-', UA_MOBILE));
  // One IP requesting many distinct nonexistent paths in quick succession.
  const scannedPaths = [
    '/admin.php', '/config.bak', '/.env', '/.git/config', '/backup.zip', '/phpmyadmin/',
    '/wp-content/debug.log', '/old/index.php', '/test.php', '/shell.php', '/db.sql', '/.aws/credentials',
    '/console', '/actuator/health', '/server-status', '/vendor/.env',
  ];
  scannedPaths.forEach((p, i) => {
    lines.push(combinedLogLine('203.0.113.66', 5 + i * 2, 'GET', p, 404, 209, '-', 'curl/8.0'));
  });
  return { id: 'B', label: 'many 404 / many paths from one IP', lines };
}

function fixtureC_ApiServerErrors(): GoldenFixture {
  const lines: string[] = [];
  lines.push(combinedLogLine('192.0.2.13', 0, 'GET', '/', 200, 4200, '-', UA_DESKTOP));
  const ips = ['198.51.100.30', '198.51.100.31', '198.51.100.32', '198.51.100.33'];
  for (let i = 0; i < 14; i += 1) {
    const ip = ips[i % ips.length]!;
    const status = i % 6 === 0 ? 200 : 500;
    lines.push(combinedLogLine(ip, 10 + i * 4, 'GET', '/api/orders', status, status === 200 ? 2048 : 512, '-', UA_DESKTOP));
  }
  return { id: 'C', label: 'API 500 responses', lines };
}

// ---------------------------------------------------------------------------
// Benchmark harness — depends only on the AIProvider interface (§106: model /
// reasoning effort / promptVersion must stay comparable across runs, which
// only holds if the harness itself never special-cases a specific Provider).
// ---------------------------------------------------------------------------

interface RunConfig {
  provider: AIProvider;
  model: string;
  reasoningEffort?: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

interface BenchmarkResult {
  fixtureId: string;
  fixtureLabel: string;
  model: string;
  reasoningEffort?: string;
  promptVersion: string;
  latencyMs: number;
  groundingPass: boolean;
  groundingError?: string;
  referenceCount: number;
  validReferenceCount: number;
  findingCount: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  summary: string;
  overallUrgency: { level: string; reason: string };
  findings: Array<{
    title: string;
    observation: string;
    interpretation?: string;
    limitation?: string;
    nextChecks: string[];
  }>;
  dataLimitations: string[];
}

function countReferences(result: AIExplanationResult, observationSet: ObservationSet): { total: number; valid: number } {
  const validGroupIds = collectObservationGroupIds(observationSet);
  const allReferences = [...result.overallUrgency.references, ...result.findings.flatMap((f) => f.references)];
  let valid = 0;
  for (const ref of allReferences) {
    if (validGroupIds.has(ref.groupId)) valid += 1;
  }
  return { total: allReferences.length, valid };
}

async function buildObservationSetFromFixture(fixture: GoldenFixture): Promise<ObservationSet> {
  async function* linesFrom(): AsyncGenerator<string> {
    for (const line of fixture.lines) yield line;
  }
  const result = await analyzeAccessLog(linesFrom());
  if (result.analyzerStatus === 'failed') {
    throw new Error(`Fixture ${fixture.id} (${fixture.label}): analyzeAccessLog returned failed (${result.errorCode})`);
  }
  return result.observationSet;
}

async function runFixture(fixture: GoldenFixture, config: RunConfig): Promise<BenchmarkResult> {
  const observationSet = await buildObservationSetFromFixture(fixture);
  const input: AIExplanationInput = {
    analysisId: randomUUID(),
    analyzerStatus: 'success',
    observationSet,
  };
  const prompt = buildInitialExplanationPrompt(input);

  const startedAt = performance.now();
  const providerResult = await config.provider.generateExplanation({
    prompt,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    ...(config.reasoningEffort !== undefined ? { providerOptions: { reasoningEffort: config.reasoningEffort } } : {}),
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  const modelOutput = aiExplanationModelOutputSchema.parse(providerResult.output);
  const result = assignFindingIds(modelOutput);
  const { total: referenceCount, valid: validReferenceCount } = countReferences(result, observationSet);

  let groundingPass = true;
  let groundingError: string | undefined;
  try {
    validateGrounding(result, observationSet);
  } catch (error) {
    groundingPass = false;
    groundingError = error instanceof GroundingValidationError ? error.message : String(error);
  }

  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    model: config.model,
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    promptVersion: prompt.promptVersion,
    latencyMs,
    groundingPass,
    ...(groundingError !== undefined ? { groundingError } : {}),
    referenceCount,
    validReferenceCount,
    findingCount: result.findings.length,
    ...(providerResult.usage !== undefined ? { usage: providerResult.usage } : {}),
    summary: result.summary,
    overallUrgency: { level: result.overallUrgency.level, reason: result.overallUrgency.reason },
    findings: result.findings.map((f) => ({
      title: f.title,
      observation: f.observation,
      ...(f.interpretation !== undefined ? { interpretation: f.interpretation } : {}),
      ...(f.limitation !== undefined ? { limitation: f.limitation } : {}),
      nextChecks: f.nextChecks,
    })),
    dataLimitations: result.dataLimitations,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log('');
  console.log(`=== Fixture ${result.fixtureId}: ${result.fixtureLabel} ===`);
  console.log(`  Grounding: ${result.groundingPass ? 'PASS' : `FAIL — ${result.groundingError}`}`);
  console.log(`  Reference Validity: ${result.validReferenceCount}/${result.referenceCount}`);
  console.log(`  Latency: ${result.latencyMs}ms`);
  if (result.usage) {
    console.log(
      `  Tokens: input=${result.usage.inputTokens ?? '?'} output=${result.usage.outputTokens ?? '?'} total=${result.usage.totalTokens ?? '?'}`,
    );
  }
  console.log(`  Findings: ${result.findingCount}`);
  console.log(`  Urgency: ${result.overallUrgency.level} — ${result.overallUrgency.reason}`);
  console.log(`  Summary: ${result.summary}`);
  result.findings.forEach((f, i) => {
    console.log(`  [Finding ${i + 1}] ${f.title}`);
    console.log(`    観測: ${f.observation}`);
    if (f.interpretation) console.log(`    解釈: ${f.interpretation}`);
    if (f.limitation) console.log(`    分からないこと: ${f.limitation}`);
    console.log(`    次に確認: ${f.nextChecks.join(' / ')}`);
  });
  if (result.dataLimitations.length > 0) {
    console.log(`  Data Limitations: ${result.dataLimitations.join(' / ')}`);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    console.error(
      'ai-benchmark: OPENAI_API_KEY and OPENAI_MODEL must both be set (in the environment or .env). ' +
        'This script makes real OpenAI API calls and is never run in CI.',
    );
    process.exitCode = 1;
    return;
  }
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;

  const provider = selectProvider('openai', { apiKey });
  const config: RunConfig = {
    provider,
    model,
    ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    timeoutMs: 90000,
    maxOutputTokens: 4096,
  };

  const fixtures = [fixtureA_WordPressLoginPost(), fixtureB_ManyNotFoundFromOneIp(), fixtureC_ApiServerErrors()];
  const results: BenchmarkResult[] = [];
  for (const fixture of fixtures) {
    console.log(`Running fixture ${fixture.id}: ${fixture.label}...`);
    // Sequential, not parallel — keeps per-fixture Latency readings
    // uncontended by the others sharing the same OpenAI account's rate limit.
    const result = await runFixture(fixture, config);
    results.push(result);
    printResult(result);
  }

  const resultsDir = path.join(scriptDir, 'ai-benchmark-results');
  mkdirSync(resultsDir, { recursive: true });
  const reportPath = path.join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify({ model, reasoningEffort, promptVersion: results[0]?.promptVersion, results }, null, 2));

  console.log('');
  console.log(`Report written to ${reportPath}`);
  const failedCount = results.filter((r) => !r.groundingPass).length;
  if (failedCount > 0) {
    console.error(`${failedCount}/${results.length} fixture(s) failed Grounding Validation.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('ai-benchmark failed', error);
  process.exitCode = 1;
});
