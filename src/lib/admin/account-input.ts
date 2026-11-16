import type { Grant } from "../auth/policy";

export const accountModes = {
  toch_admin: "Administrador TOCH",
  account_manager: "Gerente de Cuenta TOCH",
  collaborator: "Colaborador TOCH",
  manager_collaborator: "Gerente de Cuenta y Colaborador TOCH",
  client_contract_admin: "Administrador de Contrato cliente",
  client_collaborator: "Colaborador Cliente",
  client_collaborator_contract: "Colaborador Cliente y Encargado de cliente",
} as const;
export type AccountMode = keyof typeof accountModes;
export type ScopeOption = { id: string; name: string; is_active: boolean; client_id?: string; client_type?: string };
export type AccountRecord = { id: string; email: string; is_active: boolean; has_signed_in: boolean; updated_at: string; grants: Grant[] };
export type AccountInput = { id: string | null; email: string; active: boolean; grants: Grant[]; expected: string | null };
// Accept PostgreSQL UUIDs used by imported scopes, including existing all-zero test fixtures.
export const isUuid = (value: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function accountMode(grants: Grant[]): AccountMode | "" {
  const roles = new Set(grants.map((grant) => grant.role));
  if (roles.size === 0) return "";
  if (roles.size === 2 && roles.has("account_manager") && roles.has("collaborator")) return "manager_collaborator";
  if (roles.size === 2 && roles.has("client_collaborator") && roles.has("client_contract_admin")) return "client_collaborator_contract";
  if (roles.size !== 1) return "";
  const role = grants[0].role;
  return role;
}

export function parseAccountInput(form: FormData): AccountInput {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const id = String(form.get("account_id") ?? "");
  const expected = String(form.get("expected_updated_at") ?? "");
  const active = form.get("active") === "on";
  const mode = String(form.get("mode") ?? "");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresá un correo electrónico válido.");
  if (id && (!isUuid(id) || !expected || !Number.isFinite(Date.parse(expected)))) throw new Error("La cuenta no es válida. Recargá la página.");
  if (mode && !Object.hasOwn(accountModes, mode)) throw new Error("Seleccioná un perfil autorizado.");
  if (active && !mode) throw new Error("Seleccioná el perfil para habilitar el acceso.");
  function values(key: string) {
    const result = [...new Set(form.getAll(key).map(String))];
    if (result.length > 200 || result.some((value) => !isUuid(value))) throw new Error("Seleccioná alcances válidos.");
    return result;
  }
  const clients = values("clients");
  const projects = values("projects");
  const grants: Grant[] = [];
  if (mode === "toch_admin") grants.push({ role: "toch_admin", client_id: null, project_id: null });
  if (mode === "account_manager" || mode === "manager_collaborator") {
    if (!clients.length) throw new Error("Seleccioná al menos un cliente para el Gerente de Cuenta.");
    grants.push(...clients.map((client_id) => ({ role: "account_manager" as const, client_id, project_id: null })));
  }
  if (mode === "collaborator" || mode === "manager_collaborator") {
    if (!projects.length) throw new Error("Seleccioná al menos un proyecto para el Colaborador.");
    grants.push(...projects.map((project_id) => ({ role: "collaborator" as const, project_id, client_id: null })));
  }
  if (mode === "client_contract_admin" || mode === "client_collaborator") {
    if (clients.length !== 1) throw new Error("Seleccioná exactamente una empresa cliente.");
    grants.push({ role: mode, client_id: clients[0], project_id: null });
  }
  if (mode === "client_collaborator_contract") {
    if (!id || clients.length !== 1) throw new Error("Seleccioná un colaborador existente y su empresa cliente.");
    grants.push(
      { role: "client_collaborator", client_id: clients[0], project_id: null },
      { role: "client_contract_admin", client_id: clients[0], project_id: null },
    );
  }
  return { id: id || null, email, active, grants, expected: id ? expected : null };
}
