import { loadScopes, requireAdmin } from "@/lib/admin/accounts";
import { AccountForm } from "../account-form";

export default async function NewAccountPage() {
  const actor = await requireAdmin();
  const scopes = await loadScopes();
  return <main className="admin-main"><section className="admin-panel narrow-panel"><p className="eyebrow">Administración TOCH</p><h1>Autorizar correo</h1><p className="description">Habilitá una cuenta Google antes de su primer ingreso.</p><AccountForm {...scopes} scopesAvailable={scopes.available} actorEmail={actor.email} /></section></main>;
}
