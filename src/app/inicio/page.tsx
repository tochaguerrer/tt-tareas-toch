import { requireAccess } from "@/lib/auth/access";
import { roleLabels } from "@/lib/auth/policy";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthorizedHome() {
  const access = await requireAccess();
  const roles = [...new Set(access.grants.map((grant) => grant.role))];
  if (roles.some(role => role !== "client_collaborator")) redirect("/inicio/tareas");
  return (
    <main className="admin-main"><section className="admin-panel workspace-home" aria-labelledby="home-title">
      <h1 id="home-title">Bienvenido a Teté</h1>
      <p className="description">{access.email}</p>
      <ul>{roles.map((role) => <li key={role}>{roleLabels[role]}</li>)}</ul>
      {access.requester_client && <p>Solicitante externo · {access.requester_client.name}</p>}
    </section></main>
  );
}
