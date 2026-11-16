"use client";

import { useActionState } from "react";
import { createProject } from "./project-action";

export function ProjectForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [message, action, pending] = useActionState(createProject, "");

  if (clients.length === 0) return <p>No hay clientes activos para crear un proyecto.</p>;

  return <form className="account-form" action={action}>
    <label htmlFor="project-client">Cliente</label>
    <select id="project-client" name="client_id" defaultValue="" required>
      <option value="" disabled>Elegí un cliente</option>
      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select>
    <label htmlFor="project-name">Nombre</label>
    <input id="project-name" name="name" maxLength={200} required />
    <label htmlFor="project-budget">Horas presupuestadas</label>
    <input id="project-budget" name="budget_hours" inputMode="decimal" maxLength={30} />
    <label htmlFor="project-rate">Valor hora</label>
    <input id="project-rate" name="hourly_rate" inputMode="decimal" maxLength={30} />
    {message && <p role="alert">{message}</p>}
    <div><button className="primary-button" disabled={pending}>{pending ? "Creando…" : "Crear proyecto"}</button></div>
  </form>;
}
