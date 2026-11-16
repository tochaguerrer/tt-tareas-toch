import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChangeTemporaryPasswordForm } from "../client-password-form";
import { signOut } from "../actions";

export default async function ChangeTemporaryPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("client_password_pending");
  if (data !== true) redirect("/ingresar");
  return <main><section className="welcome">
    <h1>Cambiá tu contraseña provisoria</h1>
    <ChangeTemporaryPasswordForm />
    <p><Link href="/ingresar/mis-solicitudes">Consultar mis solicitudes</Link></p>
    <form action={signOut}><button className="text-button">Cerrar sesión</button></form>
  </section></main>;
}
