"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function replyToTask(taskId: string, projectId: string, _: string, form: FormData) {
  await requireAccess();
  if (!isUuid(taskId) || !isUuid(projectId)) return "La tarea no está disponible.";
  const body = String(form.get("body") ?? "").trim();
  const file = form.get("attachment");
  const attachment = file instanceof File && file.size ? file : null;
  if ((!body && !attachment) || body.length > 5000) return "Ingresá una respuesta de hasta 5.000 caracteres o adjuntá un archivo.";
  if (attachment && (attachment.size > 524288 || attachment.name.length > 200)) {
    return "El adjunto debe pesar hasta 512 KB y tener un nombre de hasta 200 caracteres.";
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_to_task", {
    p_task_id: taskId,
    p_body: body,
    p_filename: attachment?.name ?? null,
    p_attachment: attachment ? "\\x" + Buffer.from(await attachment.arrayBuffer()).toString("hex") : null,
  });
  if (error) return error.message === "Task closed" ? "La tarea está cerrada." : "No se pudo publicar la respuesta.";
  revalidatePath("/inicio/proyectos/" + projectId + "/tareas/" + taskId);
  return "";
}
