"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/accounts";
import { privilegedAuth } from "@/lib/supabase/client-password-admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { invitationDigest } from "@/lib/supabase/invitation";

type Result = { message?: string; link?: string; email?: string };

export async function generateClientInvitation(_: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { message: "Ingresá un correo válido." };
  }

  const admin = privilegedAuth();
  if (!admin) return { message: "La generación de invitaciones todavía está en configuración." };
  const failure = { message: "No se pudo generar la invitación. Si acabás de intentarlo, esperá 30 segundos antes de volver a probar." };
  try {
    const url = new URL("/ingresar/activar", getAppOrigin());
    const id = randomUUID();
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_client_invitation", { p_email: email, p_invitation: id });
    if (reserveError) return failure;
    if (reserved !== true) {
      return { message: "Verificá que el correo pertenezca a un dominio autorizado de un cliente activo y que no tenga ya una cuenta habilitada. Si acabás de generar otra invitación, esperá 30 segundos." };
    }

    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties.hashed_token) return failure;
    const token = `${randomBytes(32).toString("hex")}.${data.properties.hashed_token}`;
    const { data: published, error: publishError } = await admin.rpc("publish_client_invitation", {
      p_email: email, p_invitation: id, p_user: data.user.id, p_digest: invitationDigest(token),
    });
    if (publishError || published !== true) return failure;
    url.hash = new URLSearchParams({ invitacion: token }).toString();
    return { link: url.href, email };
  } catch {
    return failure;
  }
}
