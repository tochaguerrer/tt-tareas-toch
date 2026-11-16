import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseAccess, type Access } from "./policy";

export async function getAccess(): Promise<Access | null> {
  const supabase = await createClient();
  // getUser checks Auth rather than trusting the cookie or an unverified session.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: accessError } = await supabase.rpc("get_my_access");
  if (accessError) throw new Error("No se pudo verificar la autorización");
  return parseAccess(data);
}

export async function requireAccess() {
  const access = await getAccess();
  if (!access) redirect("/ingresar?estado=no-autorizado");
  return access;
}
