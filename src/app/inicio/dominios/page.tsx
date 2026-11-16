import Link from "next/link";
import { requireAdmin } from "@/lib/admin/accounts";
import { createClient } from "@/lib/supabase/server";
import { ClientForm,DomainForm,type Domain } from "./forms";
export const dynamic="force-dynamic";
export default async function DomainsPage({searchParams}:{searchParams:Promise<{estado?:string}>}) {
  await requireAdmin();
  const {estado}=await searchParams;
  const supabase=await createClient();
  const [clients,domains]=await Promise.all([
    supabase.from("clients").select("id,name,is_active").order("name"),
    supabase.from("client_domains").select("id,client_id,domain,is_active,updated_at").order("domain"),
  ]);
  const ready=!clients.error&&!domains.error;
  return <main className="admin-main"><section className="admin-panel narrow-panel">
    <Link href="/inicio">Volver a Teté</Link><p className="eyebrow">Administración TOCH</p><h1>Clientes y dominios</h1>
    <p className="description">Autorizá dominios para que sus integrantes presenten solicitudes para el cliente correspondiente.</p>
    {["cliente","dominio"].includes(estado??"")&&<p className="notice" role="status">Los cambios se guardaron.</p>}
    {!ready ? <p className="notice">La configuración de clientes y dominios todavía no está disponible. Es necesario completar la actualización de la base de datos.</p> : <>
      <details><summary>Agregar un cliente</summary><ClientForm/></details>
      <h2>Autorizar un dominio</h2>{!clients.data?.length&&<p className="notice">Primero agregá el cliente al que pertenecerán las solicitudes.</p>}
      <DomainForm clients={clients.data??[]}/>
      <h2>Dominios registrados</h2>
      {!domains.data?.length&&<p>Todavía no hay dominios autorizados.</p>}
      {domains.data?.map(domain=><details key={domain.id}><summary>{domain.domain} · {clients.data?.find(c=>c.id===domain.client_id)?.name} · {domain.is_active?"Habilitado":"Deshabilitado"}</summary><DomainForm clients={clients.data??[]} domain={domain as Domain}/></details>)}
    </>}
  </section></main>;
}

