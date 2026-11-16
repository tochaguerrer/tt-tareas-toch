import Link from "next/link";
import { requireAdmin } from "@/lib/admin/accounts";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "./project-form";

const pageSize = 25;

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<{ estado?: string; pagina?: string }>;
}) {
  await requireAdmin();
  const { estado, pagina } = await searchParams;
  const page = /^[1-9][0-9]{0,5}$/.test(pagina ?? "") ? Number(pagina) : 1;
  const start = (page - 1) * pageSize;
  const supabase = await createClient();
  const [clients, projects] = await Promise.all([
    supabase.from("clients").select("id,name").eq("is_active", true).order("name"),
    supabase.from("projects")
      .select("id,name,budget_hours,is_active,client:clients(name),rate:project_hourly_rates(hourly_rate)")
      .order("name").order("id").range(start, start + pageSize)
      .overrideTypes<{
        id: string;
        name: string;
        budget_hours: number | null;
        is_active: boolean;
        client: { name: string } | null;
        rate: { hourly_rate: number } | null;
      }[], { merge: false }>(),
  ]);

  return <main className="admin-main">
    <section className="admin-panel">
      <h1>Proyectos</h1>
      {estado === "creado" && <p className="notice" role="status">Proyecto creado.</p>}
      {clients.error || projects.error ? <p role="alert">No se pudo cargar la administración de proyectos.</p> : <>
        <h2>Nuevo proyecto</h2>
        <ProjectForm clients={clients.data} />
        <h2>Proyectos registrados</h2>
        {projects.data.length === 0 ? <p>No hay proyectos en esta página.</p> :
          <div className="task-table-wrap">
            <table className="task-table">
              <thead><tr><th>Proyecto</th><th>Cliente</th><th>Estado</th><th>Horas presupuestadas</th><th>Valor hora</th></tr></thead>
              <tbody>{projects.data.slice(0, pageSize).map(project => <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.client?.name ?? "—"}</td>
                <td>{project.is_active ? "Activo" : "Inactivo"}</td>
                <td>{project.budget_hours ?? "—"}</td>
                <td>{project.rate?.hourly_rate ?? "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        {(page > 1 || projects.data.length > pageSize) && <nav className="pagination" aria-label="Páginas de proyectos">
          {page > 1 && <Link href={`?pagina=${page - 1}`}>Anterior</Link>}
          {projects.data.length > pageSize && <Link href={`?pagina=${page + 1}`}>Siguiente</Link>}
        </nav>}
      </>}
    </section>
  </main>;
}
