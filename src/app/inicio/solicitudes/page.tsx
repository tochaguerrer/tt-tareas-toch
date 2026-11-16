import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAccess } from "@/lib/auth/access";
import { RequestForm } from "./request-form";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function RequestsPage(){
  const access=await requireAccess();
  const supabase=await createClient();
  const {error:storageError}=access.requester_client ? await supabase.from("request_attachments").select("id").limit(0) : {error:null};
  return <main className="admin-main"><section className="admin-panel narrow-panel"><Link href="/inicio">Volver a Teté</Link><h1>Solicitud de Servicio</h1>
    {access.requester_client ? <><p className="description">Cliente: <strong>{access.requester_client.name}</strong></p><p className="field-help">Correo verificado: {access.email}. El cliente se determina por el dominio habilitado de tu correo.</p><RequestForm requestId={randomUUID()} storageReady={!storageError}/></>:<p className="notice">Tu correo no tiene un dominio habilitado para este formulario.</p>}
  </section></main>;
}

