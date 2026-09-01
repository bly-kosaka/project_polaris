import { AggregationEngine } from './aggregation/aggregation-engine.js';
import { DEFAULT_AGGREGATION_CONFIG } from './aggregation/types.js';
import type { AggregationConfig } from './aggregation/types.js';
import { validateResolvedConfig } from './config-validation.js';
import { AggregationError, mapAnalyzerFailure } from './errors.js';
import type { AnalyzerFailureResult } from './errors.js';
import { checkExclusion } from './exclusion/apply-exclusion.js';
import { ExclusionSummaryBuilder } from './exclusion/exclusion-summary-builder.js';
import type { ExclusionConfig } from './exclusion/types.js';
import { annotateAggregationSet } from './known-information/annotate-aggregation.js';
import { BUILT_IN_KNOWN_INFORMATION_DATASET, BUILT_IN_KNOWN_INFORMATION_DATASET_VERSION } from './known-information/built-in-dataset.js';
import { KnownInformationStore } from './known-information/known-information-store.js';
import type { KnownInformationEntry } from './known-information/types.js';
import { buildObservationSet } from './observation-set/build-observation-set.js';
import { validateObservationSet } from './observation-set/validate-observation-set.js';
import type { ObservationSet } from './observation-set/types.js';
import { parseAccessLogStream } from './parse-access-log.js';
import { DEFAULT_REDACTION_CONFIG } from './redaction/types.js';
import type { RedactionConfig } from './redaction/types.js';
import { DEFAULT_CANDIDATE_SELECTION_CONFIG } from './selection/types.js';
import type { CandidateSelectionConfig } from './selection/types.js';
import { deriveAnalyzerStatus } from './summary/derive-analyzer-status.js';
import type { ParseSummary } from './types/parse-summary.js';

export interface AnalyzeAccessLogConfig {
  exclusion?: Partial<ExclusionConfig>;
  aggregation?: Partial<AggregationConfig>;
  selection?: Partial<CandidateSelectionConfig>;
  redaction?: Partial<RedactionConfig>;
}

export type AnalyzeAccessLogResult =
  | { analyzerStatus: 'success' | 'partial'; observationSet: ObservationSet }
  | AnalyzerFailureResult;

function resolveExclusionConfig(partial: Partial<ExclusionConfig> | undefined): ExclusionConfig {
  return { rules: partial?.rules ?? [] };
}

function resolveAggregationConfig(partial: Partial<AggregationConfig> | undefined): AggregationConfig {
  return { ...DEFAULT_AGGREGATION_CONFIG, ...partial };
}

function resolveSelectionConfig(partial: Partial<CandidateSelectionConfig> | undefined): CandidateSelectionConfig {
  return { ...DEFAULT_CANDIDATE_SELECTION_CONFIG, ...partial };
}

function resolveRedactionConfig(partial: Partial<RedactionConfig> | undefined): RedactionConfig {
  return { ...DEFAULT_REDACTION_CONFIG, ...partial };
}

/**
 * The Production Analyzer Pipeline. The entire body — including the
 * parseAccessLogStream() call, whose onEntry callback runs Exclusion and
 * AggregationEngine.consume() — sits inside one exception boundary, so a
 * throw from deep inside onEntry still resolves a classified `failed`
 * result instead of rejecting the returned promise
 * (29_Sprint_2_Implementation_Plan_Final_Addendum.md F-01).
 *
 * A Fatal analysis never returns an ObservationSet — the return type makes
 * that structurally impossible (28 §38.1).
 */
export async function analyzeAccessLog(
  lines: AsyncIterable<string>,
  config: AnalyzeAccessLogConfig = {},
  knownInformationDataset: KnownInformationEntry[] = BUILT_IN_KNOWN_INFORMATION_DATASET,
): Promise<AnalyzeAccessLogResult> {
  let parseSummary: ParseSummary | undefined;

  try {
    const exclusionConfig = resolveExclusionConfig(config.exclusion);
    const aggregationConfig = resolveAggregationConfig(config.aggregation);
    const selectionConfig = resolveSelectionConfig(config.selection);
    const redactionConfig = resolveRedactionConfig(config.redaction);

    // Validate before any streaming parse work begins — mirrors how
    // PARSER_NO_VALID_LINES is returned early without doing aggregation work
    // (31_Development_Setup_and_Third_Sprint.md §9: "不正ConfigでRaw Log処理を開始しない").
    validateResolvedConfig({ aggregation: aggregationConfig, selection: selectionConfig });

    const exclusionSummaryBuilder = new ExclusionSummaryBuilder();
    const aggregationEngine = new AggregationEngine(aggregationConfig);

    parseSummary = await parseAccessLogStream(lines, {
      onEntry(entry) {
        const exclusion = checkExclusion(entry, exclusionConfig);
        if (exclusion.excluded) {
          exclusionSummaryBuilder.add(exclusion.ruleId);
          return;
        }
        try {
          aggregationEngine.consume(entry);
        } catch (cause) {
          throw new AggregationError('Aggregation failed while consuming an entry', { cause });
        }
      },
    });

    const analyzerStatus = deriveAnalyzerStatus(parseSummary);
    if (analyzerStatus === 'failed') {
      return { analyzerStatus: 'failed', errorCode: 'PARSER_NO_VALID_LINES', parseSummary };
    }

    const aggregationSet = aggregationEngine.build();
    const store = new KnownInformationStore(knownInformationDataset);
    const annotated = annotateAggregationSet(aggregationSet, store);

    const observationSet = buildObservationSet({
      aggregationSet: annotated,
      parseSummary,
      exclusion: exclusionSummaryBuilder.build(),
      selectionConfig,
      redactionConfig,
      knownInformationDatasetVersion: BUILT_IN_KNOWN_INFORMATION_DATASET_VERSION,
    });

    validateObservationSet(observationSet);

    return { analyzerStatus, observationSet };
  } catch (error) {
    return mapAnalyzerFailure(error, parseSummary);
  }
}
