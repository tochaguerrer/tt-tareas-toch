"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function updateTask(taskId: string, projectId: string, action: "assign" | "status" | "take",
  expected: string, _: string, form: FormData) {
  await requireAccess();
  const value = action === "take" ? "take" : form.get("value");
  if (!isUuid(taskId) || !isUuid(projectId) || typeof value !== "string" || !value ||
      (action === "assign" && !isUuid(value))) return "Seleccioná una opción válida.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("task_management", {
    p_task_id: taskId, p_project_id: projectId, p_action: action, p_value: value, p_expected: expected,
  });
  if (error?.message === "Task changed") return "La tarea cambió. Recargá la página y volvé a intentar.";
  if (error) return "No se pudo guardar el cambio. Revisá los permisos y el estado de la tarea.";
  revalidatePath("/inicio/tareas");
  revalidatePath("/inicio/horas");
  revalidatePath(`/inicio/proyectos/${projectId}/tareas/${taskId}`);
  return "Cambio guardado.";
}
