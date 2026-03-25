export type BackofficeRole = "superadmin" | "admin" | "operator" | "viewer";

export interface BackofficeSession {
  accessToken: string;
  refreshToken?: string;
  email: string | null;
  role: BackofficeRole;
  userId: string;
}
