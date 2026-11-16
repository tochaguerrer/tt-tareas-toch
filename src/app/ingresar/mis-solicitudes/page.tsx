import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const pageSize = 25;

export default async function TemporaryRequestsPage({ searchParams }: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina } = await searchParams;
  const page = typeof pagina === "string" && /^[1-9]\d{0,5}$/.test(pagina) ? Number(pagina) : 1;
  const supabase = await createClient();
  const { data: pending } = await supabase.rpc("client_password_pending");
  if (pending !== true) redirect("/ingresar");
  const { data, error } = await supabase.rpc("read_temporary_client_requests", {
    p_offset: (page - 1) * pageSize,
  });
  if (error || !Array.isArray(data)) throw new Error("No se pudieron consultar tus solicitudes.");
  const requests = data as {
    reference_number: number;
    title: string;
    description: string;
  }[];

  return <main className="admin-main"><section className="admin-panel narrow-panel">
    <Link href="/ingresar/cambiar-contrasena">Cambiar contraseña provisoria</Link>
    <h1>Mis solicitudes</h1>
    {requests.length === 0 && <p>No hay solicitudes para mostrar.</p>}
    {requests.slice(0, pageSize).map(request => <details key={request.reference_number}>
      <summary>#{String(request.reference_number).padStart(6, "0")} · {request.title}</summary>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{request.description}</p>
    </details>)}
    <nav className="pagination" aria-label="Paginación de solicitudes">
      {page > 1 && <Link href={`?pagina=${page - 1}`}>Anterior</Link>}
      {requests.length > pageSize && <Link href={`?pagina=${page + 1}`}>Siguiente</Link>}
    </nav>
  </section></main>;
}
