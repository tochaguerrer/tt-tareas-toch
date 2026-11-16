import { notFound } from "next/navigation";
import { loadAccount, loadScopes, requireAdmin } from "@/lib/admin/accounts";
import { isUuid } from "@/lib/admin/account-input";
import { AccountForm } from "../account-form";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const account = await loadAccount(id);
  if (!account) notFound();
  const scopes = await loadScopes();
  return <main className="admin-main"><section className="admin-panel narrow-panel"><p className="eyebrow">Administración TOCH</p><h1>Editar permisos</h1><AccountForm account={account} {...scopes} scopesAvailable={scopes.available} actorEmail={actor.email} /></section></main>;
}
