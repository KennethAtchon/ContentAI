/** Shared context types to avoid circular imports between context files. */

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}
