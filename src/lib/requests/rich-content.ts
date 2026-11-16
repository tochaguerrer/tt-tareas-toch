export const fonts = ["Arial", "Georgia", "Verdana", "Courier New"] as const;
export type RichNode = {type:string;text?:string;attrs?:Record<string,string|number>;marks?:{type:string;attrs?:Record<string,string>}[];content?:RichNode[]};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateDocument(value: unknown, assetIds: string[]) {
  let nodes=0, text="";
  const images:string[]=[];
  function visit(raw:unknown,depth:number):RichNode {
    if(!raw||typeof raw!=="object"||depth>20||++nodes>3000)throw new Error("El contenido del detalle no es válido o es demasiado extenso.");
    const item=raw as Record<string,unknown>;
    const type=String(item.type);
    if(!["doc","paragraph","heading","text","hardBreak","bulletList","orderedList","listItem","blockquote","codeBlock","horizontalRule","image"].includes(type))throw new Error("El detalle contiene un bloque no admitido.");
    const node:RichNode={type};
    const attrs=(item.attrs??{}) as Record<string,unknown>;
    if(type==="text"){
      if(typeof item.text!=="string")throw new Error("Texto inválido.");
      node.text=item.text;text+=item.text;
    }
    if(type==="heading")node.attrs={level:[1,2,3].includes(Number(attrs.level))?Number(attrs.level):2};
    if(type==="orderedList")node.attrs={start:Number.isInteger(attrs.start)&&Number(attrs.start)>0&&Number(attrs.start)<=10000?Number(attrs.start):1};
    if(type==="image"){
      const id=String(attrs.attachmentId??"");
      if(!uuid.test(id)||!assetIds.includes(id))throw new Error("Una imagen todavía no está adjunta. Esperá a que termine de cargarse.");
      images.push(id);node.attrs={attachmentId:id,src:"attachment:"+id,alt:String(attrs.alt??"Imagen adjunta").slice(0,200)};
    }
    if(Array.isArray(item.marks))node.marks=item.marks.map(rawMark=>{
      const mark=rawMark as {type:string;attrs?:Record<string,unknown>};
      if(["bold","italic","underline","strike","code"].includes(mark.type))return {type:mark.type};
      if(mark.type==="textStyle"){
        const clean:Record<string,string>={};
        const family=String(mark.attrs?.fontFamily??"").replaceAll('"',"").replaceAll("'","");
        if((fonts as readonly string[]).includes(family))clean.fontFamily=family;
        const color=String(mark.attrs?.color??"");
        if(/^#[0-9a-f]{6}$/i.test(color))clean.color=color.toLowerCase();
        // Browsers serialize pasted CSS colors as rgb().
        const rgb=/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(color);
        if(rgb&&rgb.slice(1).every(v=>Number(v)<=255))clean.color="#"+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,"0")).join("");
        return {type:mark.type,attrs:clean};
      }
      if(mark.type==="link"){
        const href=String(mark.attrs?.href??"");
        if(!/^https?:\/\//i.test(href)||href.length>2048)throw new Error("Solo se admiten enlaces HTTP o HTTPS.");
        const parsed=new URL(href);
        if(parsed.username||parsed.password)throw new Error("El enlace no puede contener credenciales.");
        return {type:"link",attrs:{href:parsed.href}};
      }
      throw new Error("El formato del texto no es válido.");
    });
    if(Array.isArray(item.content))node.content=item.content.map(child=>visit(child,depth+1));
    if(["paragraph","heading","codeBlock","hardBreak"].includes(type))text+="\n";
    return node;
  }
  const document=visit(value,0);
  if(document.type!=="doc"||JSON.stringify(document).length>200000||text.trim().length>10000||(!text.trim()&&!images.length))throw new Error("Ingresá un detalle de hasta 10.000 caracteres o pegá una imagen.");
  return {document,text:text.trim()||"[Imagen adjunta]",images};
}
export const maxFileBytes=10*1024*1024;
export const fileMime:Record<string,string>={
  png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",pdf:"application/pdf",
  txt:"text/plain",csv:"text/csv",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",zip:"application/zip",
};
export function attachmentType(name:string,size:number){
  const mime=fileMime[name.toLowerCase().split(".").pop()??""];
  if(!mime||name.length>200||size<=0||size>maxFileBytes)throw new Error("Adjuntá imágenes, PDF, TXT, CSV, DOCX, XLSX, PPTX o ZIP de hasta 10 MB.");
  return mime;
}

