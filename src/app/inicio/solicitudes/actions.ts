"use server";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { validateDocument } from "@/lib/requests/rich-content";
import { isUuid } from "@/lib/admin/account-input";
export type RequestState={error:string;receipt:string};
export async function submitRequest(previous:RequestState,form:FormData):Promise<RequestState>{
  const access=await requireAccess();
  if (!access.requester_client) return {error:"Tu correo ya no tiene un dominio habilitado para presentar solicitudes.",receipt:""};
  const id=String(form.get("request_id")??"");
  if(!isUuid(id))return {error:"Recargá el formulario antes de enviar.",receipt:""};
  const title=String(form.get("title")??"").trim();
  const assets=form.getAll("attachment_ids").map(String);
  if(!title||title.length>200||assets.length>10||assets.some(asset=>!isUuid(asset)))return {error:"Revisá el título y los adjuntos.",receipt:""};
  let input;
  try{
    const raw=String(form.get("description_document")??"");
    if(raw.length>200000)throw new Error("El detalle es demasiado extenso.");
    input=validateDocument(JSON.parse(raw),assets);
  }catch(error){return {error:error instanceof SyntaxError?"El detalle no tiene un formato válido.":(error as Error).message,receipt:""};}
  const supabase=await createClient();
  const payload={p_id:id,p_title:title,p_document:input.document,p_attachment_ids:assets};
  let {data,error}=await supabase.rpc("submit_external_request_with_reference",payload);
  if(error?.code==="PGRST202"){
    ({data,error}=await supabase.rpc("submit_external_request_rich",payload));
  }
  if(error)return {error:"No se pudo enviar la solicitud. Verificá tu acceso e intentá nuevamente.",receipt:""};
  return {error:"",receipt:String(data)};
}

