"use client";
import Link from "next/link";
import {useActionState,useRef,useState} from "react";
import type {Editor} from "@tiptap/react";
import {RichEditor} from "./rich-editor";
import {submitRequest} from "./actions";
import {createBrowserSupabase} from "@/lib/supabase/browser";
import {attachmentType} from "@/lib/requests/rich-content";
type Asset={id:string;file:File;mime:string;url?:string;path?:string;status:"uploading"|"ready"|"error";error?:string};
export function RequestForm({requestId,storageReady}:{requestId:string;storageReady:boolean}){
  const [state,action,pending]=useActionState(submitRequest,{error:"",receipt:""});
  const [title,setTitle]=useState("");
  const [document,setDocument]=useState('{"type":"doc","content":[{"type":"paragraph"}]}');
  const [assets,setAssets]=useState<Asset[]>([]);
  const assetsRef=useRef<Asset[]>([]);
  const editorRef=useRef<Editor|null>(null);
  const [fileError,setFileError]=useState("");
  function replaceAsset(id:string,updates:Partial<Asset>){
    assetsRef.current=assetsRef.current.map(asset=>asset.id===id?{...asset,...updates}:asset);setAssets([...assetsRef.current]);
  }
  async function addFiles(files:File[]){
    if(pending)return;
    if(!storageReady){setFileError("El envío de adjuntos todavía está en configuración.");return;}
    setFileError("");
    for(const file of files){
      let mime;
      try{mime=attachmentType(file.name,file.size);}catch(error){setFileError((error as Error).message);continue;}
      if(assetsRef.current.length>=10||assetsRef.current.reduce((total,asset)=>total+asset.file.size,0)+file.size>20*1024*1024){setFileError("Límite: 10 cargas y 20 MB por solicitud.");break;}
      const id=crypto.randomUUID();
      assetsRef.current=[...assetsRef.current,{id,file,mime,status:"uploading"}];setAssets([...assetsRef.current]);
      try{
        const supabase=createBrowserSupabase();
        const reservation=await supabase.rpc("reserve_request_attachment",{p_id:id,p_request_id:requestId,p_filename:file.name,p_mime:mime,p_bytes:file.size});
        if(reservation.error)throw new Error("No se pudo preparar el adjunto. Verificá tu acceso y la configuración.");
        replaceAsset(id,{path:String(reservation.data)});
        const upload=await supabase.storage.from("request-attachments").upload(String(reservation.data),new Blob([file],{type:mime}),{contentType:mime,upsert:false});
        if(upload.error)throw new Error("No se pudo cargar el archivo. El detalle todavía no fue enviado.");
        const url=mime.startsWith("image/")?URL.createObjectURL(file):undefined;
        replaceAsset(id,{status:"ready",url});
        if(url&&editorRef.current){const editor=editorRef.current;editor.chain().focus().insertContent({type:"image",attrs:{src:url,attachmentId:id,alt:file.name}}).run();setDocument(JSON.stringify(editor.getJSON()));}
      }catch(error){replaceAsset(id,{status:"error",error:(error as Error).message});}
    }
  }
  async function removeAsset(id:string){
    const asset=assetsRef.current.find(asset=>asset.id===id);
    if(!asset)return;
    replaceAsset(id,{status:"uploading"});
    try{
      if(asset.path){
        const supabase=createBrowserSupabase();
        const removal=await supabase.storage.from("request-attachments").remove([asset.path]);
        if(removal.error)throw new Error("No se pudo quitar el archivo. Intentá nuevamente.");
        const discard=await supabase.rpc("discard_request_attachment",{p_id:id});
        if(discard.error)throw new Error("No se pudo quitar el adjunto. Recargá si la solicitud ya se envió.");
      }
    }catch(error){replaceAsset(id,{status:"error",error:(error as Error).message});return;}
    const editor=editorRef.current;
    if(editor){
      const positions:{pos:number;size:number}[]=[];
      editor.state.doc.descendants((node,pos)=>{if(node.type.name==="image"&&node.attrs.attachmentId===id)positions.push({pos,size:node.nodeSize});});
      const transaction=editor.state.tr;positions.reverse().forEach(({pos,size})=>transaction.delete(pos,pos+size));
      editor.view.dispatch(transaction);setDocument(JSON.stringify(editor.getJSON()));
    }
    if(asset.url)URL.revokeObjectURL(asset.url);
    assetsRef.current=assetsRef.current.filter(asset=>asset.id!==id);setAssets([...assetsRef.current]);
  }
  if(state.receipt)return <section aria-labelledby="receipt-title"><h2 id="receipt-title">Solicitud recibida</h2><p role="status">La solicitud, su formato y sus adjuntos se enviaron para revisión de TOCH.</p><p className="field-help">Referencia: {state.receipt}</p><a className="primary-button" href="/inicio/solicitudes">Enviar otra solicitud</a><p><Link href="/inicio">Volver a Teté</Link></p></section>;
  const uploading=assets.some(asset=>asset.status==="uploading");
  return <form action={action} className="account-form">
    {!storageReady&&<p className="notice" role="status">El editor ya está disponible para revisar. El envío con formato y adjuntos todavía está en configuración.</p>}
    <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="description_document" value={document}/>
    {assets.filter(asset=>asset.status==="ready").map(asset=><input key={asset.id} type="hidden" name="attachment_ids" value={asset.id}/>)}
    <label htmlFor="request-title">Título</label><input id="request-title" name="title" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} disabled={pending}/>
    <strong>Detalle</strong>
    <RichEditor
      onReady={editor => { editorRef.current = editor; }}
      onChange={setDocument}
      onAddFiles={files => { void addFiles(files); }}
      disabled={pending}
      attachmentsDisabled={pending || uploading || !storageReady}
      attachments={<>
        <p className="field-help">Hasta 10 archivos, 10 MB por archivo y 20 MB en total.</p>
        {fileError && <p className="form-error" role="alert">{fileError}</p>}
        {assets.length > 0 && <ul className="editor-attachment-list" aria-label="Adjuntos">
          {assets.map(asset => <li key={asset.id}>
            <div>
              <strong>{asset.file.name}</strong>
              <div className="field-help" role="status">
                {(asset.file.size / 1024).toFixed(1)} KB · {asset.status === "uploading" ? "Procesando…" : asset.status === "ready" ? "Adjunto" : "Error"}
              </div>
              {asset.error && <p className="field-help" role="alert">{asset.error}</p>}
            </div>
            <button type="button" className="text-button" aria-label={`Quitar ${asset.file.name}`}
              disabled={pending || asset.status === "uploading"} onClick={() => { void removeAsset(asset.id); }}>Quitar</button>
          </li>)}
        </ul>}
      </>}
    />
    <p className="field-help">No incluyas contraseñas ni credenciales.</p>
    {state.error&&<p role="alert" className="form-error">{state.error}</p>}
    <div><button className="primary-button" disabled={pending||uploading||!storageReady||assets.some(asset=>asset.status==="error")}>{pending?"Enviando…":uploading?"Esperando adjuntos…":"Enviar solicitud"}</button></div>
  </form>;
}
