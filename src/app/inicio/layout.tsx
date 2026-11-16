import type { ReactNode } from "react";
import { signOut } from "@/app/ingresar/actions";
import { requireAccess } from "@/lib/auth/access";
import { WorkspaceNavigation, type NavigationItem } from "./workspace-navigation";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const access = await requireAccess();
  const roles = access.grants.map(grant => grant.role);
  const admin = roles.includes("toch_admin");
  const hours = admin || roles.includes("account_manager") || roles.includes("collaborator");
  const requests = admin || roles.includes("account_manager") || roles.includes("client_contract_admin");
  const items: NavigationItem[] = [];

  if (roles.some(role => role !== "client_collaborator")) {
    items.push({ href: "/inicio/tareas", label: "Tareas", icon: "☑" });
  } else {
    items.push({ href: "/inicio", label: "Inicio", icon: "⌂" });
  }
  if (hours) {
    items.push(
      { href: "/inicio/horas", label: "Registro de horas", icon: "◷" },
      { href: "/inicio/horas/estado", label: "Estado de horas", icon: "▤" },
    );
  }
  if (access.requester_client) {
    items.push({ href: "/inicio/solicitudes", label: "Solicitud de Servicio", icon: "+" });
  }
  if (requests || roles.includes("client_collaborator")) {
    items.push({ href: "/inicio/solicitudes/recibidas", label: requests ? "Solicitudes recibidas" : "Mis solicitudes", icon: "▣" });
  }
  if (admin) {
    items.push(
      { href: "/inicio/proyectos", label: "Proyectos", icon: "▧" },
      { href: "/inicio/usuarios", label: "Administrar usuarios", icon: "♙" },
      { href: "/inicio/dominios", label: "Clientes y dominios", icon: "▦" },
    );
  }

  return <div className="workspace">
    <WorkspaceNavigation items={items} signOut={signOut} />
    <div className="workspace-content">{children}</div>
  </div>;
}
