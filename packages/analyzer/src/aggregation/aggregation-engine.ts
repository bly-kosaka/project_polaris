import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import { OverviewAggregator } from './overview-aggregator.js';
import { PathAggregator } from './path-aggregator.js';
import { SourceIpAggregator } from './source-ip-aggregator.js';
import { SourceIpPathAggregator } from './source-ip-path-aggregator.js';
import { StatusAggregator, MethodAggregator } from './status-method-aggregator.js';
import { TimeAggregator } from './time-aggregator.js';
import { DEFAULT_AGGREGATION_CONFIG } from './types.js';
import type { AggregationConfig, AggregationSet } from './types.js';
import { UserAgentAggregator } from './user-agent-aggregator.js';

/**
 * Incremental consumer: one entry in, internal state updated, entry
 * discarded — never accumulates NormalizedAccessLogEntry[]
 * (28_Development_Setup_and_Second_Sprint.md §7).
 */
export class AggregationEngine {
  private readonly overview: OverviewAggregator;
  private readonly path: PathAggregator;
  private readonly sourceIp: SourceIpAggregator;
  private readonly sourceIpPath: SourceIpPathAggregator;
  private readonly status: StatusAggregator;
  private readonly method: MethodAggregator;
  private readonly userAgent: UserAgentAggregator;
  private readonly time: TimeAggregator;

  constructor(config: AggregationConfig = DEFAULT_AGGREGATION_CONFIG) {
    this.overview = new OverviewAggregator();
    this.path = new PathAggregator(config);
    this.sourceIp = new SourceIpAggregator(config);
    this.sourceIpPath = new SourceIpPathAggregator();
    this.status = new StatusAggregator(config.topPathLimit);
    this.method = new MethodAggregator(config.topPathLimit);
    this.userAgent = new UserAgentAggregator(config);
    this.time = new TimeAggregator(config);
  }

  consume(entry: NormalizedAccessLogEntry): void {
    this.overview.consume(entry);
    this.path.consume(entry);
    this.sourceIp.consume(entry);
    this.sourceIpPath.consume(entry);
    this.status.consume(entry);
    this.method.consume(entry);
    this.userAgent.consume(entry);
    this.time.consume(entry);
  }

  build(): AggregationSet {
    return {
      paths: this.path.finalize(),
      sourceIps: this.sourceIp.finalize(),
      sourceIpPaths: this.sourceIpPath.finalize(),
      statuses: this.status.finalize(),
      methods: this.method.finalize(),
      userAgents: this.userAgent.finalize(),
      timeBuckets: this.time.finalize(),
      overview: this.overview.finalize(),
    };
  }
}
