/** Never a priority/severity/risk value — only which axis picked a group (28 §24). */
export type SelectionReason =
  | 'known_information'
  | 'request_count'
  | 'distinct_source_ip'
  | 'distinct_path'
  | 'status_4xx'
  | 'status_5xx'
  | 'method_post'
  | 'response_size'
  | 'representative';

export interface SelectedGroup<T> {
  value: T;
  selectionReasons: SelectionReason[];
}

export interface CandidateSelectionConfig {
  requestCountLimit: number;
  distinctSourceIpLimit: number;
  distinctPathLimit: number;
  clientErrorLimit: number;
  serverErrorLimit: number;
  postLimit: number;
  responseSizeLimit: number;
  representativeLimit: number;
  knownInformationLimit: number;
  pathTotalLimit: number;
  sourceIpTotalLimit: number;
  sourceIpPathTotalLimit: number;
  userAgentTotalLimit: number;
  statusTotalLimit: number;
  methodTotalLimit: number;
  time1mLimit: number;
  time5mLimit: number;
}

/** Values are AI-input size controls, not danger thresholds (08 §18.7 / 28 §26). */
export const DEFAULT_CANDIDATE_SELECTION_CONFIG: CandidateSelectionConfig = {
  requestCountLimit: 20,
  distinctSourceIpLimit: 20,
  distinctPathLimit: 20,
  clientErrorLimit: 20,
  serverErrorLimit: 20,
  postLimit: 20,
  responseSizeLimit: 20,
  representativeLimit: 5,
  knownInformationLimit: 40,
  pathTotalLimit: 80,
  sourceIpTotalLimit: 60,
  sourceIpPathTotalLimit: 80,
  userAgentTotalLimit: 30,
  statusTotalLimit: 20,
  methodTotalLimit: 20,
  time1mLimit: 120,
  time5mLimit: 120,
};
