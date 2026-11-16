"use server";

import { redirect } from "next/navigation";
import { updateTask } from "../proyectos/task-management-action";

export async function updateHoursTaskStatus(taskId: string, projectId: string, expected: string,
  weekQuery: string, previous: string, form: FormData) {
  const result = await updateTask(taskId, projectId, "status", expected, previous, form);
  if (result === "Cambio guardado." && form.get("value") === "closed") {
    const params = new URLSearchParams(weekQuery);
    if (!params.getAll("cerrada").includes(taskId)) params.append("cerrada", taskId);
    redirect(`/inicio/horas?${params}`);
  }
  return result;
}
