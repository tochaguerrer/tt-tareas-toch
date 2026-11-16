"use client";
import { useActionState } from "react";
import { createClientRecord, saveDomain } from "./actions";
export type Domain = {id:string;client_id:string;domain:string;is_active:boolean;updated_at:string};
type Client = {id:string;name:string;is_active:boolean};
export function ClientForm() {
  const [state,action,pending]=useActionState(createClientRecord,{error:""});
  return <form action={action} className="account-form"><h2>Agregar cliente</h2>
    <label htmlFor="client-name">Nombre del cliente</label><input id="client-name" name="name" required maxLength={200}/>
    <label htmlFor="client-type">Tipo</label><select id="client-type" name="type" required><option value="">Seleccionar</option><option value="external">Externo</option><option value="internal">Interno TOCH</option></select>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <div><button className="primary-button" disabled={pending}>{pending?"Guardando…":"Crear cliente"}</button></div>
  </form>;
}
export function DomainForm({clients,domain}:{clients:Client[];domain?:Domain}) {
  const [state,action,pending]=useActionState(saveDomain,{error:""});
  const suffix=domain?.id??"new";
  return <form action={action} className="account-form">
    {domain && <><input type="hidden" name="id" value={domain.id}/><input type="hidden" name="expected" value={domain.updated_at}/></>}
    <label htmlFor={"domain-client-"+suffix}>Cliente</label>
    {domain ? <><p>{clients.find(c=>c.id===domain.client_id)?.name??"Cliente"}</p><input type="hidden" name="client_id" value={domain.client_id}/></>:
      <select id={"domain-client-"+suffix} name="client_id" required defaultValue=""><option value="">Seleccionar cliente</option>{clients.filter(c=>c.is_active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    <label htmlFor={"domain-"+suffix}>Dominio exacto del correo</label><input id={"domain-"+suffix} name="domain" required maxLength={253} readOnly={Boolean(domain)} defaultValue={domain?.domain} placeholder="empresa.com"/>
    <p className="field-help">Solo coincide el dominio indicado; los subdominios se habilitan por separado.</p>
    <label className="check-label"><input type="checkbox" name="active" defaultChecked={domain?.is_active??true}/>Dominio habilitado</label>
    <label className="check-label"><input type="checkbox" name="confirm" required/>Confirmo que habilitar este dominio permite presentar solicitudes a cualquier persona con un correo Google verificado de ese dominio, sin autorizar cada correo.</label>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <div><button className="primary-button" disabled={pending||!clients.length}>{pending?"Guardando…":domain?"Guardar estado":"Autorizar dominio"}</button></div>
  </form>;
}

