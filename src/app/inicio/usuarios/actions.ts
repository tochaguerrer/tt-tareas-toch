"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/accounts";
import { isUuid, parseAccountInput } from "@/lib/admin/account-input";
import { createClient } from "@/lib/supabase/server";

export type SaveState = { error: string };

function databaseMessage(code: string) {
  if (code === "40001") return "Otra operación modificó esta cuenta. Recargá la página antes de guardar.";
  if (code === "23505") return "Ese correo ya está autorizado o tiene asignaciones repetidas.";
  if (code === "23503") return "El cliente o proyecto seleccionado ya no está disponible.";
  if (code === "P0001") return "No se puede quitar ni desactivar al último Administrador TOCH activo.";
  if (code === "42501") return "Tu cuenta ya no tiene permiso para administrar usuarios.";
  return "No se pudieron guardar los cambios. Revisá los datos o intentá nuevamente.";
}

export async function saveAccount(_previous: SaveState, form: FormData): Promise<SaveState> {
  const actor = await requireAdmin();
  let input;
  try { input = parseAccountInput(form); }
  catch (error) { return { error: error instanceof Error ? error.message : "Revisá los datos." }; }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_account", {
    p_account_id: input.id, p_email: input.email, p_active: input.active,
    p_grants: input.grants, p_expected_updated_at: input.expected,
  });
  if (error) return { error: databaseMessage(error.code) };
  revalidatePath("/inicio/usuarios", "layout");
  revalidatePath("/inicio");
  if (input.email === actor.email && (!input.active || !input.grants.some((grant) => grant.role === "toch_admin"))) {
    redirect("/inicio");
  }
  redirect("/inicio/usuarios?estado=guardado");
}

export async function transferAdministration(_previous: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const target = String(form.get("target_id") ?? "");
  const expected = String(form.get("expected_updated_at") ?? "");
  if (!isUuid(target) || !Number.isFinite(Date.parse(expected))) return { error: "Seleccioná una cuenta válida y recargá si fue modificada." };
  if (form.get("confirm_transfer") !== "on") return { error: "Confirmá la transferencia antes de continuar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_transfer_administration", { p_target_id: target, p_expected_updated_at: expected });
  if (error) return { error: databaseMessage(error.code) };
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/inicio/usuarios", "layout");
  redirect("/ingresar?estado=transferido");
}
