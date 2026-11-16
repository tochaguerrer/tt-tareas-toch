import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { RequestDetail } from "./request-detail";
import { ClientFilter } from "./client-filter";

const pageSize = 25;
const requestsPath = "/inicio/solicitudes/recibidas";
const reference = (number: number) => String(number).padStart(6, "0");

export default async function ReceivedRequests({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; referencia?: string; pagina?: string }>;
}) {
  const access = await requireAccess();
  if (!access.grants.some(({ role }) =>
    role === "toch_admin" || role === "account_manager" || role === "client_contract_admin" || role === "client_collaborator"
  )) notFound();

  const { cliente, referencia, pagina } = await searchParams;
  const clientId = typeof cliente === "string" ? cliente : "";
  const validClient = !clientId || isUuid(clientId);
  const search = typeof referencia === "string" ? referencia.trim() : "";
  const valid = /^[0-9]{1,6}$/.test(search) && Number(search) > 0;
  const page = /^[1-9][0-9]{0,5}$/.test(pagina ?? "") ? Number(pagina) : 1;
  const supabase = await createClient();
  function resultsLink(filters: { referencia?: string; pagina?: string } = {}) {
    const params = new URLSearchParams(filters);
    if (clientId && validClient) params.set("cliente", clientId);
    return params.size ? `${requestsPath}?${params}` : requestsPath;
  }
  const start = (page - 1) * pageSize;
  const query = supabase.from("incoming_requests")
    .select("id,reference_number,title,requester_email,created_at,client:clients(name)")
    .order("reference_number", { ascending: false });
  if (clientId && validClient) query.eq("client_id", clientId);
  const filtered = search
    ? query.eq("reference_number", Number(search))
    : query.range(start, start + pageSize);
  const [clients, result] = await Promise.all([
    supabase.from("clients").select("id,name").order("name").order("id"),
    !validClient || (search && !valid) ? null : filtered
    .overrideTypes<Array<{
      id: string;
      reference_number: number;
      title: string;
      requester_email: string;
      created_at: string;
      client: { name: string } | null;
    }>, { merge: false }>(),
  ]);
  if (clients.error) throw new Error("No se pudieron consultar los clientes.");
  if (result?.error) throw new Error("No se pudieron consultar las solicitudes.");
  const rows = result?.data ?? [];

  return (
    <main className="admin-main">
      <section className="admin-panel narrow-panel">
        <Link href="/inicio">Volver a Teté</Link>
        <h1>{access.grants.every(grant => grant.role === "client_collaborator") ? "Mis solicitudes" : "Solicitudes recibidas"}</h1>
        {clients.data.length > 0 && <div className="account-search">
          <label htmlFor="cliente">Filtrar por cliente</label>
          <div>
            <ClientFilter clientId={clientId} reference={search} action={requestsPath}>
              <option value="">Todos los clientes</option>
              {clients.data.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </ClientFilter>
            {clientId && <Link href={search ? `${requestsPath}?${new URLSearchParams({ referencia: search })}` : requestsPath}>Limpiar</Link>}
          </div>
        </div>}
        <form action={requestsPath} className="form-actions">
          {clientId && validClient && <input type="hidden" name="cliente" value={clientId} />}
          <label htmlFor="referencia">Referencia de la solicitud</label>
          <input id="referencia" name="referencia" inputMode="numeric" maxLength={6}
            pattern="[0-9]{1,6}" placeholder="000002" defaultValue={search} key={search}
            aria-describedby="reference-help" />
          <span id="reference-help" className="field-help">Presioná Enter para consultar por referencia.</span>
          {search && <Link href={resultsLink()}>Quitar referencia</Link>}
        </form>
        {!validClient ? <p>Seleccioná un cliente válido.</p> :
          search && !valid ? <p>Ingresá una referencia de hasta seis dígitos.</p> :
          rows.length === 0 ? <p>No hay solicitudes para mostrar.</p> :
          <ul>
            {rows.slice(0, pageSize).map(row => (
              <li key={row.id}>
                <Link href={resultsLink({ referencia: reference(row.reference_number) })}>
                  {reference(row.reference_number)} · {row.title}
                </Link>
                <p className="field-help">
                  {row.client?.name && <>{row.client.name} · </>}Creada por {row.requester_email} · {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
                  }).format(new Date(row.created_at))}
                </p>
                {valid && <RequestDetail id={row.id} />}
              </li>
            ))}
          </ul>}
        {!search && validClient && <nav className="form-actions" aria-label="Páginas de solicitudes">
          {page > 1 && <Link href={resultsLink({ pagina: String(page - 1) })}>Anterior</Link>}
          {rows.length > pageSize && <Link href={resultsLink({ pagina: String(page + 1) })}>Siguiente</Link>}
        </nav>}
      </section>
    </main>
  );
}
