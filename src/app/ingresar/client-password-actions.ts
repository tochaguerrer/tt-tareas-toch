"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { privilegedAuth } from "@/lib/supabase/client-password-admin";

const validEmail = (email: string) => email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

export async function signInClientPassword(_: string, form: FormData): Promise<string> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!validEmail(email) || !password || Buffer.byteLength(password) > 72) return "Revisá el correo y la contraseña.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "Revisá el correo y la contraseña.";
  const { data: pending } = await supabase.rpc("client_password_pending");
  if (pending === true) {
    const { error: registrationError } = await supabase.rpc("register_client_with_temporary_password");
    if (!registrationError) redirect("/ingresar/cambiar-contrasena");
    await supabase.auth.signOut({ scope: "local" });
    return "No se pudo completar el alta. Intentá nuevamente o contactá al Administrador TOCH.";
  }
  const access = await supabase.rpc("get_my_access");
  if (!access.error && access.data?.grants?.length) redirect("/inicio");
  await supabase.auth.signOut({ scope: "local" });
  return "El acceso no está habilitado. Si la contraseña provisoria venció, contactá al Administrador TOCH.";
}

export async function changeTemporaryPassword(_: string, form: FormData): Promise<string> {
  const current = String(form.get("current_password") ?? "");
  const password = String(form.get("password") ?? "");
  if (!current || Buffer.byteLength(current) > 72 || password.length < 12 || Buffer.byteLength(password) > 72 ||
      password === current || password !== form.get("confirmation")) {
    return "Ingresá la contraseña provisoria y confirmá una distinta de al menos 12 caracteres y hasta 72 bytes.";
  }

  const admin = privilegedAuth();
  if (!admin) return "El acceso todavía está en configuración.";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: pending } = await supabase.rpc("client_password_pending");
  if (!user || pending !== true) return "El acceso provisorio venció. Volvé a ingresar o contactá al Administrador TOCH.";
  const { error } = await supabase.auth.updateUser({ password, current_password: current });
  if (error) return "No pudimos cambiar la contraseña. Revisá los datos.";
  const { error: activationError } = await admin.rpc("complete_client_password", { p_user: user.id });
  await supabase.auth.signOut({ scope: "global" });
  if (activationError) redirect("/ingresar?estado=activacion-pendiente");
  redirect("/ingresar?estado=contrasena-actualizada");
}
