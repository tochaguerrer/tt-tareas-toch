"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function convertRequest(_: string, form: FormData): Promise<string> {
  await requireAccess();
  const requestId = String(form.get("request_id") ?? "");
  const projectId = String(form.get("project_id") ?? "");
  if (!isUuid(requestId) || !isUuid(projectId)) {
    return "Seleccioná un proyecto existente.";
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_request_to_task", {
    p_request_id: requestId,
    p_project_id: projectId,
    p_new_project_name: null,
  });
  if (error) return "No se pudo convertir la solicitud. Verificá el proyecto y tus permisos.";
  revalidatePath("/inicio/solicitudes/recibidas");
  return "";
}
