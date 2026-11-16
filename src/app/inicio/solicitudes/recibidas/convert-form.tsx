"use client";

import { useActionState } from "react";
import { convertRequest } from "./convert-action";

export function ConvertForm({ id, projects }: {
  id: string;
  projects: { id: string; name: string }[];
}) {
  const [error, action, pending] = useActionState(convertRequest, "");
  if (projects.length === 0) return (
    <section>
      <h2>Convertir en tarea</h2>
      <p>Este cliente no tiene proyectos activos disponibles para asignar la tarea.</p>
    </section>
  );

  return (
    <form action={action}>
      <h2>Convertir en tarea</h2>
      <input type="hidden" name="request_id" value={id} />
      <p>
        <label htmlFor="project_id">Proyecto</label>{" "}
        <select id="project_id" name="project_id" defaultValue="" required>
          <option value="">Elegí un proyecto</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </p>
      <button className="primary-button" disabled={pending}>
        {pending ? "Convirtiendo…" : "Convertir en tarea"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
