import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function privilegedAuth() {
  const config = getSupabaseConfig();
  const secret = process.env.TETE_SUPABASE_SECRET_KEY;
  if (!config || !secret?.startsWith("sb_secret_")) return null;
  return createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
