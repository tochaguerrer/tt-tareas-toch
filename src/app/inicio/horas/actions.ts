"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth/access";
import { isUuid } from "@/lib/admin/account-input";
import { createClient } from "@/lib/supabase/server";
import { manualHoursToSeconds } from "./duration";

export async function saveHours(_: string, form: FormData) {
  await requireAccess();
  const db = await createClient();
  const value = (key: string) => String(form.get(key) ?? "");
  const action = value("operation");
  const id = value("id");
  const task = value("task");
  const detail = value("detail").trim();
  const classification = value("billable");
  const billable = classification === "yes" ? true : classification === "no" ? false : null;
  let result;
  if (action === "draft") {
    const seconds = manualHoursToSeconds(value("hours"));
    if (seconds === null) return "Ingresá entre 0,5 y 24 horas, en pasos de media hora.";
    const date = value("date");
    if (!isUuid(id) || !isUuid(task) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        detail.length > 5000 || billable === null) {
      return "Revisá la tarea, la fecha, la duración y la clasificación. El detalle admite hasta 5000 caracteres.";
    }
    result = await db.rpc("save_manual_time_draft", {
      p_id: id, p_task_id: task, p_work_date: date, p_seconds: seconds, p_detail: detail, p_billable: billable,
    });
  } else if (["start", "pause", "resume", "finish", "classify"].includes(action)) {
    if (!isUuid(id) || (action === "start" && !isUuid(task))) return "Seleccioná una tarea.";
    result = await db.rpc("manage_timer", {
      p_action: action, p_session: id, p_task: action === "start" ? task : null,
      p_detail: detail || null, p_billable: billable,
    });
  } else if (action === "generic" && isUuid(task)) {
    result = await db.rpc("set_generic_task", { p_task: task, p_generic: value("generic") === "yes" });
  } else if (action === "submit") {
    result = await db.rpc("review_hours", { p_week: value("week") });
  } else if (action === "approve" && isUuid(id)) {
    result = await db.rpc("review_hours", { p_entry: id });
  } else {
    return "Acción inválida.";
  }
  if (result.error) {
    if (result.error.code === "23505" && action === "start") return "Ya tenés un temporizador iniciado o pausado.";
    if (result.error.message === "Task closed") return "La tarea está cerrada o cancelada.";
    return "No se pudo guardar. Revisá los datos, el estado de la tarea y tus permisos.";
  }
  revalidatePath("/inicio/horas");
  revalidatePath("/inicio/horas/estado");
  revalidatePath("/inicio/tareas");
  return "Guardado.";
}
