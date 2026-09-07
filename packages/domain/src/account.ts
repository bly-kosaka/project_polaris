export type AccountId = string;

/**
 * The Product Account record — Provider Credentials (password/session
 * tokens) are never stored here, only the external identity reference
 * (`authProvider`/`authSubject`) and a best-effort profile snapshot
 * (Sprint 7, 50_Development_Setup_and_Seventh_Sprint.md §4).
 */
export interface Account {
  id: AccountId;
  authProvider: 'clerk';
  authSubject: string;
  email?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
