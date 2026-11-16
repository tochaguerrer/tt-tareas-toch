import { requireAdmin } from "@/lib/admin/accounts";
import { createClient } from "@/lib/supabase/server";
import { TransferForm } from "./transfer-form";
import type { AccountRecord } from "@/lib/admin/account-input";

export default async function TransferPage() {
  const actor = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_accounts").select("id,email,is_active,updated_at")
    .eq("is_active", true).not("auth_user_id", "is", null).neq("email", actor.email).order("email");
  if (error) throw new Error("No se pudieron cargar destinatarios");
  const accounts = (data ?? []).map((account) => ({ ...account, has_signed_in: true, grants: [] })) as AccountRecord[];
  return <main className="admin-main"><section className="admin-panel narrow-panel"><p className="eyebrow">Administración TOCH</p><h1>Transferir administración</h1><p className="description">Revisá cuidadosamente la cuenta destinataria. La transferencia se realiza en una única operación.</p><TransferForm accounts={accounts} /></section></main>;
}
