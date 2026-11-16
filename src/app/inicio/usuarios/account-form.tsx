"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { accountMode, accountModes, type AccountMode, type AccountRecord, type ScopeOption } from "@/lib/admin/account-input";
import { roleLabels, type Grant } from "@/lib/auth/policy";
import { saveAccount } from "./actions";

const rolesByMode: Record<AccountMode, Grant["role"][]> = {
  toch_admin: ["toch_admin"],
  account_manager: ["account_manager"],
  collaborator: ["collaborator"],
  manager_collaborator: ["account_manager", "collaborator"],
  client_contract_admin: ["client_contract_admin"],
  client_collaborator: ["client_collaborator"],
  client_collaborator_contract: ["client_collaborator", "client_contract_admin"],
};

export function AccountForm({ account, clients, projects, scopesAvailable, actorEmail }: {
  account?: AccountRecord; clients: ScopeOption[]; projects: ScopeOption[]; scopesAvailable: boolean; actorEmail: string;
}) {
  const [state, action, pending] = useActionState(saveAccount, { error: "" });
  const [mode, setMode] = useState<AccountMode | "">(account ? accountMode(account.grants) : "");
  const [active, setActive] = useState(account?.is_active ?? true);
  const [email, setEmail] = useState(account?.email ?? "");
  const [selectedClients, setSelectedClients] = useState(account?.grants.flatMap((grant) => grant.client_id ? [grant.client_id] : []) ?? []);
  const [selectedProjects, setSelectedProjects] = useState(account?.grants.flatMap((grant) => grant.project_id ? [grant.project_id] : []) ?? []);
  const [reviewing, setReviewing] = useState(false);
  const collaboratorGrant = account?.grants.find(grant => grant.role === "client_collaborator");
  const canAddContract = Boolean(account?.has_signed_in && collaboratorGrant);
  const singleClient = mode === "client_contract_admin" || mode === "client_collaborator" || mode === "client_collaborator_contract";
  const wantsClients = singleClient || mode === "account_manager" || mode === "manager_collaborator";
  const clientOptions = mode === "client_collaborator_contract"
    ? clients.filter(client => client.id === collaboratorGrant?.client_id)
    : mode === "client_collaborator" ? clients.filter(client => client.client_type === "external") : clients;
  const wantsProjects = ["collaborator", "manager_collaborator"].includes(mode);
  const self = email.trim().toLowerCase() === actorEmail;
  const selectedRoles = mode ? rolesByMode[mode] : [];
  const availableModes = (Object.keys(accountModes) as AccountMode[]).filter(value =>
    (value !== "client_collaborator_contract" || canAddContract) &&
    (value !== "client_contract_admin" || accountMode(account?.grants ?? []) === "client_contract_admin")
  );
  const availableRoles = [...new Set(availableModes.flatMap(value => rolesByMode[value]))];
  function toggleRole(role: Grant["role"]) {
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter(selected => selected !== role)
      : [...selectedRoles, role];
    if (!nextRoles.length) return "";
    return availableModes.find(value => rolesByMode[value].length === nextRoles.length &&
      nextRoles.every(selected => rolesByMode[value].includes(selected)));
  }
  function changeMode(next: AccountMode | "") {
    const nextRoles = next ? rolesByMode[next] : [];
    if (next === "client_collaborator_contract" && collaboratorGrant?.client_id) {
      setSelectedClients([collaboratorGrant.client_id]);
    } else if (!nextRoles.some(role => role !== "collaborator" && role !== "toch_admin" && selectedRoles.includes(role))) {
      setSelectedClients([]);
    }
    if (!nextRoles.includes("collaborator")) setSelectedProjects([]);
    setMode(next);
    setReviewing(false);
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (active && !mode) { event.preventDefault(); return; }
    if (!reviewing) { event.preventDefault(); setReviewing(true); }
  }
  return <form action={action} onSubmit={onSubmit} className="account-form">
    {account && <><input type="hidden" name="account_id" value={account.id} /><input type="hidden" name="expected_updated_at" value={account.updated_at} /></>}
    <label htmlFor="account-email">Correo electrónico</label>
    <input id="account-email" name="email" type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setReviewing(false); }} readOnly={Boolean(account)} autoComplete="off" />
    {account && <p className="field-help">Para cambiar de correo, autorizá la nueva cuenta. El acceso previo se puede desactivar por separado.</p>}
    <label className="check-label"><input name="active" type="checkbox" checked={active} onChange={(event) => { setActive(event.target.checked); setReviewing(false); }} />Cuenta habilitada</label>
    <input type="hidden" name="mode" value={mode} />
    <fieldset><legend>Roles de acceso</legend>
      <p className="field-help">Gerente de Cuenta y Colaborador TOCH se pueden combinar. A un Colaborador Cliente ya vinculado se le puede agregar Encargado de cliente para la misma empresa.</p>
      {availableRoles.map(role => {
        const next = toggleRole(role);
        return <label className="check-label" key={role}>
          <input type="checkbox" checked={selectedRoles.includes(role)} disabled={next === undefined}
            onChange={() => { if (next !== undefined) changeMode(next); }} />
          {role === "client_contract_admin" ? "Encargado de cliente" : roleLabels[role]}
        </label>;
      })}
    </fieldset>
    <p className="field-help">Solicitante externo accede por el dominio habilitado de su correo verificado, sin alta individual. Los dominios se configuran en <Link href="/inicio/dominios">Clientes y dominios</Link>.</p>
    {!scopesAvailable && <p className="notice">Los clientes y proyectos todavía no están disponibles. Podés administrar cuentas globales; los perfiles con alcance necesitan registros de cliente o proyecto.</p>}
    {wantsClients && <fieldset><legend>{singleClient ? "Empresa cliente (una sola)" : "Clientes asignados"}</legend>
      {clientOptions.length === 0 && <p className="field-help">Todavía no hay clientes para asignar.</p>}
      {clientOptions.map((client) => <label className="check-label" key={client.id}><input type={singleClient ? "radio" : "checkbox"} name="clients" value={client.id} checked={selectedClients.includes(client.id)} disabled={!client.is_active && !selectedClients.includes(client.id)} onChange={(event) => { setSelectedClients(singleClient ? [client.id] : event.target.checked ? [...selectedClients, client.id] : selectedClients.filter((id) => id !== client.id)); setReviewing(false); }} />{client.name}{!client.is_active && " (inactivo)"}</label>)}
    </fieldset>}
    {wantsProjects && <fieldset><legend>Proyectos asignados</legend>
      {projects.length === 0 && <p className="field-help">Todavía no hay proyectos para asignar.</p>}
      {projects.map((project) => <label className="check-label" key={project.id}><input type="checkbox" name="projects" value={project.id} checked={selectedProjects.includes(project.id)} disabled={!project.is_active && !selectedProjects.includes(project.id)} onChange={(event) => { setSelectedProjects(event.target.checked ? [...selectedProjects, project.id] : selectedProjects.filter((id) => id !== project.id)); setReviewing(false); }} />{project.name} · {clients.find((client) => client.id === project.client_id)?.name ?? "Cliente"}{!project.is_active && " (inactivo)"}</label>)}
    </fieldset>}
    {selectedRoles.includes("toch_admin") && <p className="notice">Administrador TOCH tiene alcance global para operar en todos los clientes y proyectos, administrar usuarios y acceder a información económica.</p>}
    {reviewing && <section aria-labelledby="review-title" className="change-review"><h2 id="review-title">Revisar cambios</h2>
      <p><strong>{email}</strong> · {active ? "Habilitada" : "Desactivada"}</p>
      <p>{mode ? accountModes[mode] : "Sin perfil"}</p>
      {wantsClients && <p>Clientes: {clients.filter((client) => selectedClients.includes(client.id)).map((client) => client.name).join(", ") || "Ninguno"}</p>}
      {wantsProjects && <p>Proyectos: {projects.filter((project) => selectedProjects.includes(project.id)).map((project) => project.name).join(", ") || "Ninguno"}</p>}
      {self && (!active || !selectedRoles.includes("toch_admin")) && <p className="notice">Estás cambiando tu propia cuenta. Perderás acceso a la administración al guardar.</p>}
      <p className="field-help">Los cambios se aplican al confirmar. No se envían invitaciones por correo.</p>
    </section>}
    {state.error && <p className="form-error" role="alert">{state.error} <button type="button" className="text-button" onClick={() => window.location.reload()}>Recargar datos</button></p>}
    <div className="form-actions"><button className="primary-button" disabled={pending || (active && !mode)}>{pending ? "Guardando…" : reviewing ? "Confirmar y guardar" : "Revisar cambios"}</button>{reviewing && <button type="button" className="text-button" disabled={pending} onClick={() => setReviewing(false)}>Seguir editando</button>}<Link href="/inicio/usuarios">Volver a usuarios</Link></div>
  </form>;
}
