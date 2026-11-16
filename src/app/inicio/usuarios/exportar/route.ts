import { requireAdmin } from "@/lib/admin/accounts";
import { roleLabels } from "@/lib/auth/policy";
import { createClient } from "@/lib/supabase/server";

type ReportRow = {
  email: string;
  name: string | null;
  active: boolean | null;
  role: keyof typeof roleLabels | null;
  client: string | null;
  project: string | null;
  domain_client: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
};

const timeZone = "America/Argentina/Buenos_Aires";
const dateTime = new Intl.DateTimeFormat("es-AR", { timeZone, dateStyle: "short", timeStyle: "short" });

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "";
}

function csvCell(value: string) {
  // Treat account and client fields as text, even if they resemble formulas.
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_user_access");
  const headers = { "Cache-Control": "private, no-store" };
  if (error || !Array.isArray(data)) {
    return new Response("El reporte de usuarios no está disponible. Volvé a Usuarios e intentá nuevamente.", {
      status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const rows = [
    ["Correo", "Nombre", "Estado de cuenta", "Rol asignado", "Cliente del rol", "Proyecto asignado",
      "Cliente por dominio", "Alta individual", "Última actualización", "Último ingreso"],
    ...(data as ReportRow[]).map(row => [
      row.email, row.name ?? "",
      row.active === null ? "Sin alta individual" : row.active ? "Activa" : "Inactiva",
      row.role ? roleLabels[row.role] : "Sin rol individual",
      row.client ?? (row.role === "toch_admin" ? "Todos los clientes" : ""),
      row.project ?? "", row.domain_client ?? "", formatDate(row.created_at),
      formatDate(row.updated_at), formatDate(row.last_sign_in_at),
    ]),
  ];
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short" }).format(new Date());
  return new Response("\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n", {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Usuarios-Tete-${date}.csv"`,
    },
  });
}
