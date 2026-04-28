import { supabase } from "@/lib/supabase";

const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Authorization header = HS256 anon JWT (the Supabase gateway only accepts
// HS256; user-session JWTs are ES256 and get rejected at the gateway before
// the function ever runs). X-User-Auth carries the user session so functions
// can validate role / business membership via shared/utils auth helpers.
export async function invokeFunction<T = unknown>(name: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { Authorization: `Bearer ${ANON_KEY}` };
  if (session?.access_token) {
    headers["X-User-Auth"] = `Bearer ${session.access_token}`;
  }
  return supabase.functions.invoke<T>(name, { body, headers });
}
