import "server-only";

import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export function shift(day: string, offset: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function loadHoursContext(week: string | undefined) {
  const access = await requireAccess();
  const admin = access.grants.some(g => g.role === "toch_admin");
  const manager = access.grants.some(g => g.role === "account_manager");
  if (!admin && !manager && !access.grants.some(g => g.role === "collaborator")) notFound();

  const db = await createClient();
  const account = await db.from("app_accounts").select("id,time_zone").eq("email", access.email).maybeSingle();
  if (account.error?.code === "42703") return null;
  if (account.error || !account.data) throw new Error("No se pudo cargar la configuración de horas.");

  const { id: accountId, time_zone: zone } = account.data;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, dateStyle: "short" }).format();
  const chosen = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week)
    && Number.isFinite(Date.parse(week)) ? week : today;
  const monday = shift(chosen, -((new Date(chosen + "T00:00:00Z").getUTCDay() + 6) % 7));
  const canReview = (task: { client_id: string }) =>
    admin || access.grants.some(g => g.role === "account_manager" && g.client_id === task.client_id);

  return { db, access, admin, manager, accountId, zone, monday, canReview };
}
