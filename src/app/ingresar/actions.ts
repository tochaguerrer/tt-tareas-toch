"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin, getSupabaseConfig } from "@/lib/supabase/config";

export async function signInWithGoogle() {
  if (!getSupabaseConfig()) redirect("/ingresar?estado=configuracion");
  let target: string | undefined;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAppOrigin()}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (!error) target = data.url;
  } catch { /* Show a generic error without logging tokens or provider details. */ }
  if (!target) redirect("/ingresar?estado=error");
  redirect(target);
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/ingresar?estado=error");
  redirect("/ingresar");
}
