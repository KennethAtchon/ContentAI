/**
 * Hono context variable types (auth + validation).
 * Kept separate from middleware so route and lib code can depend on types only.
 */

export interface AuthResult {
  user: { id: string; email: string; role: string };
  firebaseUser: {
    uid: string;
    email: string;
    stripeRole?: string;
    [key: string]: unknown;
  };
}

export interface AdminAuthResult extends AuthResult {
  user: { id: string; email: string; role: "admin" };
}

export type AuthContext = AuthResult | AdminAuthResult | null;

/** Context variables set by middleware. Use `HonoEnv` when instantiating Hono in route files. */
export type Variables = {
  auth: AuthResult;
  validatedBody: unknown;
  validatedQuery: unknown;
  rateLimitHeaders: Record<string, string>;
};

export type HonoEnv = { Variables: Variables };
