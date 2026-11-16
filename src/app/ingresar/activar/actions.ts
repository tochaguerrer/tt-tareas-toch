"use server";

import { redirect } from "next/navigation";
import { privilegedAuth } from "@/lib/supabase/client-password-admin";
import { invitationDigest } from "@/lib/supabase/invitation";
import { createClient } from "@/lib/supabase/server";

export async function acceptClientInvitation(_: string, form: FormData): Promise<string> {
  const token = String(form.get("invitation") ?? "");
  const password = String(form.get("password") ?? "");
  const invalid = "La invitación venció, ya se usó o dejó de estar habilitada. Pedile un nuevo enlace al Administrador TOCH.";

  if (!/^[a-f0-9]{64}\.(?:[a-f0-9]{56}|[a-f0-9]{64})$/.test(token)) return invalid;
  if (password.length < 12 || Buffer.byteLength(password) > 72 || password !== form.get("confirmation")) {
    return "Ingresá una contraseña de al menos 12 caracteres y hasta 72 bytes y confirmala.";
  }

  const admin = privilegedAuth();
  if (!admin) return "El acceso todavía está en configuración.";
  const digest = invitationDigest(token);
  try {
    const { data: invitedUser, error: inviteError } = await admin.rpc("client_invitation_user", { p_digest: digest });
    if (inviteError || !invitedUser) return invalid;
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: token.slice(65) });
    if (error || !data.user) return invalid;

    try {
      if (data.user.id !== invitedUser) return invalid;
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) return "No se pudo guardar la contraseña. Pedile un nuevo enlace al Administrador TOCH.";
      const { data: completed, error: completionError } = await admin.rpc("complete_client_invitation", {
        p_digest: digest, p_user: invitedUser,
      });
      if (completionError || completed !== true) return invalid;
    } finally {
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    return "No se pudo completar el alta. Contactá al Administrador TOCH.";
  }
  redirect("/ingresar?estado=invitacion-aceptada");
}
