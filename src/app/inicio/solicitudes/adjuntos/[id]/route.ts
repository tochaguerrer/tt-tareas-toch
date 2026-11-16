import {NextResponse,type NextRequest} from "next/server";
import {requireAccess} from "@/lib/auth/access";
import {createClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/admin/account-input";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  await requireAccess();
  const {id}=await params;
  if(!isUuid(id))return new NextResponse(null,{status:404});
  const supabase=await createClient();
  const {data,error}=await supabase.from("request_attachments").select("filename,storage_path,mime_type").eq("id",id).maybeSingle();
  if(error||!data)return new NextResponse(null,{status:404});
  const inline=request.nextUrl.searchParams.get("inline")==="1"&&["image/png","image/jpeg","image/gif","image/webp"].includes(data.mime_type);
  const signed=await supabase.storage.from("request-attachments").createSignedUrl(data.storage_path,60,{download:inline?false:data.filename});
  if(signed.error||!signed.data)return new NextResponse(null,{status:404});
  const response=NextResponse.redirect(signed.data.signedUrl);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
}
