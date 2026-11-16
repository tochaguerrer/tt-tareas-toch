"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/accounts";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/account-input";
import { normalizeDomain } from "@/lib/requests/input";

export type DomainState = { error: string };
export async function createClientRecord(_previous: DomainState, form: FormData): Promise<DomainState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const type = String(form.get("type") ?? "");
  if (!name || name.length > 200 || !["internal","external"].includes(type)) return {error:"Completá el nombre y tipo de cliente."};
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_client",{p_name:name,p_type:type});
  if (error) return {error:"No se pudo crear el cliente. Verificá la configuración e intentá nuevamente."};
  revalidatePath("/inicio/dominios");
  redirect("/inicio/dominios?estado=cliente");
}
export async function saveDomain(_previous: DomainState, form: FormData): Promise<DomainState> {
  await requireAdmin();
  const client = String(form.get("client_id") ?? "");
  const id = String(form.get("id") ?? "");
  const expected = String(form.get("expected") ?? "");
  if (!isUuid(client) || (id && (!isUuid(id) || !Number.isFinite(Date.parse(expected))))) return {error:"Seleccioná un cliente válido y recargá los datos si cambiaron."};
  let domain;
  try { domain=normalizeDomain(String(form.get("domain") ?? "")); }
  catch(error) { return {error:(error as Error).message}; }
  if (form.get("confirm") !== "on") return {error:"Confirmá el alcance de la autorización por dominio."};
  const supabase = await createClient();
  const {error} = await supabase.rpc("admin_save_domain",{p_id:id||null,p_client_id:client,p_domain:domain,p_active:form.get("active")==="on",p_expected:expected||null});
  if (error) return {error:error.code==="23505" ? "El dominio ya está registrado para este cliente o habilitado para otro." : error.code==="40001" ? "El dominio cambió. Recargá antes de continuar." : "No se pudo guardar el dominio. Revisá los datos y la configuración."};
  revalidatePath("/inicio/dominios");
  redirect("/inicio/dominios?estado=dominio");
}

