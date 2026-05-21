export interface InstagramMutationResult {
  method: string;
  status: number;
  url: string;
}

export interface CleanupToastResult {
  count: number;
  text: string;
}

export interface SelectionResult {
  count: number;
  confirmedCount: number | null;
  attemptedCount: number;
  signatures: string[];
}

export interface ScrollResult {
  before: number;
  after: number;
  height: number;
}
