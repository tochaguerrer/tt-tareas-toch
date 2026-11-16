import "server-only";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import type { AccountRecord, ScopeOption } from "./account-input";

export async function requireAdmin() {
  const access = await requireAccess();
  if (!access.grants.some((grant) => grant.role === "toch_admin")) redirect("/inicio?estado=sin-permiso");
  return access;
}

export async function loadAccounts(query = "", page = 1) {
  await requireAdmin();
  const supabase = await createClient();
  let request = supabase.from("app_accounts")
    .select("id,email,is_active,auth_user_id,updated_at,access_grants(role,client_id,project_id)", { count: "exact" })
    .order("email");
  if (query) request = request.ilike("email", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await request.range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("No se pudieron cargar las cuentas");
  return {
    accounts: (data ?? []).map(({ auth_user_id, access_grants, ...account }) => ({ ...account, has_signed_in: Boolean(auth_user_id), grants: access_grants })) as AccountRecord[],
    count: count ?? 0,
  };
}

export async function loadAccount(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_accounts")
    .select("id,email,is_active,auth_user_id,updated_at,access_grants(role,client_id,project_id)").eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la cuenta");
  if (!data) return null;
  const { auth_user_id, access_grants, ...account } = data;
  return { ...account, has_signed_in: Boolean(auth_user_id), grants: access_grants } as AccountRecord;
}

export async function loadScopes() {
  await requireAdmin();
  const supabase = await createClient();
  const [clients, projects] = await Promise.all([
    supabase.from("clients").select("id,name,is_active,client_type").order("name"),
    supabase.from("projects").select("id,client_id,name,is_active").order("name"),
  ]);
  if (clients.error || projects.error) return { clients: [], projects: [], available: false };
  return { clients: clients.data as ScopeOption[], projects: projects.data as ScopeOption[], available: true };
}
