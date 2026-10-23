// Public Supabase config. Both values are safe to ship to the browser; access
// control is enforced by Row Level Security, never by hiding these.
export type SupabasePublicEnv = { url: string; key: string };

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
