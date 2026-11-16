import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ replyId: string }> }) {
  await requireAccess();
  const { replyId } = await params;
  if (!isUuid(replyId)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_replies")
    .select("filename,attachment").eq("id", replyId).maybeSingle();
  if (error || !data?.filename || !data.attachment) return new Response(null, { status: 404 });
  const bytes = Uint8Array.from(Buffer.from(data.attachment.slice(2), "hex"));
  const filename = encodeURIComponent(data.filename).replace(/[!'()*]/g, char =>
    "%" + char.charCodeAt(0).toString(16),
  );
  return new Response(bytes, { headers: {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": "attachment; filename*=UTF-8''" + filename,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
