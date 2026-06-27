import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let instance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!instance) {
    instance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return instance;
}

export function getSupabaseAdmin(): SupabaseClient {
  return getSupabase();
}
