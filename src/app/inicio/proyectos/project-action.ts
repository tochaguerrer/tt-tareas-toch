"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/admin/account-input";
import { requireAdmin } from "@/lib/admin/accounts";
import { createClient } from "@/lib/supabase/server";

export async function createProject(_: string, form: FormData): Promise<string> {
  await requireAdmin();
  const clientId = String(form.get("client_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const budgetHours = String(form.get("budget_hours") ?? "").trim().replace(",", ".");
  const hourlyRate = String(form.get("hourly_rate") ?? "").trim().replace(",", ".");
  const decimal = /^\d+(?:\.\d+)?$/;

  if (!isUuid(clientId) || !name || name.length > 200) {
    return "Seleccioná un cliente e ingresá un nombre de hasta 200 caracteres.";
  }
  if ([budgetHours, hourlyRate].some(value => value && (value.length > 30 || !decimal.test(value)))) {
    return "Ingresá números iguales o mayores a cero para las horas y el valor hora.";
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_project", {
    p_client_id: clientId,
    p_name: name,
    p_budget_hours: budgetHours || null,
    p_hourly_rate: hourlyRate || null,
  });

  if (error?.code === "22023") return "Seleccioná un cliente activo.";
  if (error) return "No se pudo crear el proyecto.";
  revalidatePath("/inicio/proyectos");
  revalidatePath("/inicio/solicitudes/recibidas");
  redirect("/inicio/proyectos?estado=creado");
}
