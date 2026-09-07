export interface CreateAccountInput {
  authProvider: string;
  authSubject: string;
  email?: string;
  emailVerified: boolean;
}
