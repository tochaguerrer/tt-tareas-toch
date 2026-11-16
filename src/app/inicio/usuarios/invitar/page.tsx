import Link from "next/link";
import { requireAdmin } from "@/lib/admin/accounts";
import { InvitationForm } from "./invitation-form";

export default async function InviteClientPage() {
  await requireAdmin();
  return <main className="admin-main"><section className="admin-panel">
    <Link className="back-link" href="/inicio/usuarios">← Usuarios y permisos</Link>
    <h1>Invitar colaborador cliente</h1>
    <p className="description">Generá un enlace para que el colaborador elija su contraseña y complete el alta.</p>
    <InvitationForm />
  </section></main>;
}
