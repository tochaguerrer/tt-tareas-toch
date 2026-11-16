export const roleLabels = {
  toch_admin: "Administrador TOCH",
  account_manager: "Gerente de Cuenta TOCH",
  collaborator: "Colaborador TOCH",
  client_contract_admin: "Administrador de Contrato cliente",
  client_collaborator: "Colaborador Cliente",
} as const;

export type Role = keyof typeof roleLabels;
export type Grant = { role: Role; client_id: string | null; project_id: string | null };
export type Access = { email: string; grants: Grant[]; requester_client: {id:string;name:string} | null };

export function parseAccess(value: unknown): Access | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.email !== "string" || !Array.isArray(record.grants)) return null;
  let requester: Access["requester_client"] = null;
  if (record.requester_client != null) {
    const client = record.requester_client as Record<string,unknown>;
    if (typeof client !== "object" || typeof client.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client.id) ||
      typeof client.name !== "string" || !client.name.trim()) return null;
    requester = {id:client.id,name:client.name};
  }
  if (record.grants.length === 0 && !requester) return null;
  const grants: Grant[] = [];
  for (const item of record.grants) {
    if (!item || typeof item !== "object") return null;
    const { role, client_id, project_id } = item;
    if (typeof role !== "string" || !Object.hasOwn(roleLabels, role)) return null;
    const client = typeof client_id === "string" ? client_id : null;
    const project = typeof project_id === "string" ? project_id : null;
    if (role === "toch_admin" && (client || project)) return null;
    if (["account_manager", "client_contract_admin", "client_collaborator"].includes(role) && (!client || project)) return null;
    if (role === "collaborator" && (!project || client)) return null;
    grants.push({ role: role as Role, client_id: client, project_id: project });
  }
  return { email: record.email, grants, requester_client:requester };
}
