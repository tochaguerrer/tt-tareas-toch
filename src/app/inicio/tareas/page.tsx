import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { taskStatusLabel } from "../proyectos/[id]/task-status";
import { ProjectFilter } from "./project-filter";

const pageSize = 25;
const hoursBatchSize = 500;

function formatTaskHours(seconds: number) {
  return (seconds / 3600).toFixed(1);
}

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<{ proyecto?: string; pagina?: string }>;
}) {
  const access = await requireAccess();
  if (!access.grants.some(grant => grant.role !== "client_collaborator")) notFound();

  const params = await searchParams;
  const projectId = typeof params.proyecto === "string" && isUuid(params.proyecto) ? params.proyecto : "";
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const supabase = await createClient();
  let query = supabase.from("tasks").select("id,task_number,title,status,project_id,project:projects(name)", { count: "exact" });
  if (projectId) query = query.eq("project_id", projectId);
  const [tasks, projects] = await Promise.all([
    query.order("task_number", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
      .overrideTypes<{ id: string; task_number: number; title: string; status: string; project_id: string; project: { name: string } | null }[], { merge: false }>(),
    supabase.from("projects").select("id,name,client:clients(name)").order("name").order("id")
      .overrideTypes<{ id: string; name: string; client: { name: string } | null }[], { merge: false }>(),
  ]);
  if (tasks.error || projects.error) throw new Error("No se pudieron cargar las tareas.");
  const totals = new Map<string, { billable: number; nonBillable: number }>();
  const taskIds = tasks.data.map(task => task.id);
  if (taskIds.length) {
    for (let offset = 0; ; offset += hoursBatchSize) {
      const hours = await supabase.from("time_entries").select("task_id,seconds,billable")
        .in("task_id", taskIds).order("id").range(offset, offset + hoursBatchSize - 1);
      if (hours.error) throw new Error("No se pudieron cargar los totales de horas.");
      for (const entry of hours.data) {
        const total = totals.get(entry.task_id) ?? { billable: 0, nonBillable: 0 };
        total[entry.billable ? "billable" : "nonBillable"] += entry.seconds;
        totals.set(entry.task_id, total);
      }
      if (hours.data.length < hoursBatchSize) break;
    }
  }
  const visibleProject = projects.data.some(project => project.id === projectId);
  function pageLink(value: number) {
    const search = new URLSearchParams({ pagina: String(value) });
    if (projectId) search.set("proyecto", projectId);
    return `/inicio/tareas?${search}`;
  }

  return <main className="admin-main"><section className="admin-panel" aria-labelledby="tasks-title">
    <h1 id="tasks-title">Tareas</h1>
    <div className="account-search">
      <label htmlFor="task-project">Filtrar por proyecto</label>
      <div>
        <ProjectFilter projectId={visibleProject ? projectId : ""}>
          <option value="">Todos los proyectos</option>
          {projects.data.map(project => <option key={project.id} value={project.id}>
            {project.name}{project.client ? ` · ${project.client.name}` : ""}
          </option>)}
        </ProjectFilter>
        {projectId && <Link href="/inicio/tareas">Limpiar</Link>}
      </div>
    </div>
    {tasks.data.length ? <div className="task-table-wrap"><table className="task-table">
      <caption className="field-help">Los totales incluyen las imputaciones visibles para tu cuenta.</caption>
      <thead><tr><th scope="col">Proyecto</th><th scope="col" aria-sort="descending">ID</th><th scope="col">Descripción</th>
        <th scope="col">Estado</th><th scope="col">Horas facturables</th><th scope="col">Horas no facturables</th></tr></thead>
      <tbody>{tasks.data.map(task => <tr key={task.id}>
        <td>{task.project?.name ?? "—"}</td>
        <td>#{task.task_number}</td>
        <td><Link href={`/inicio/proyectos/${task.project_id}/tareas/${task.id}`}>{task.title}</Link></td>
        <td>{taskStatusLabel(task.status)}</td>
        <td>{formatTaskHours(totals.get(task.id)?.billable ?? 0)}</td>
        <td>{formatTaskHours(totals.get(task.id)?.nonBillable ?? 0)}</td>
      </tr>)}</tbody>
    </table></div> : <p>No hay tareas para mostrar.</p>}
    <nav className="pagination" aria-label="Paginación de tareas">
      {page > 1 && <Link href={pageLink(page - 1)}>Anterior</Link>}
      {page * pageSize < (tasks.count ?? 0) && <Link href={pageLink(page + 1)}>Siguiente</Link>}
    </nav>
  </section></main>;
}
