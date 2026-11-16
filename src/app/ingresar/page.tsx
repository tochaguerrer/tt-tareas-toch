import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { signInWithGoogle, signOut } from "./actions";
import { ClientPasswordForms } from "./client-password-form";

const messages: Record<string, string> = {
  transferido: "La administración se transfirió correctamente. Tu cuenta quedó desactivada y tu sesión se cerró.",
  "no-autorizado": "Tu cuenta no tiene acceso habilitado. Contactá al Administrador TOCH.",
  configuracion: "El acceso todavía está en configuración.",
  "contrasena-actualizada": "Contraseña actualizada. Ingresá con tu nueva contraseña.",
  "invitacion-aceptada": "Tu cuenta está activa. Ingresá con tu correo y contraseña.",
  "activacion-pendiente": "No se pudo completar el alta. Contactá al Administrador TOCH.",
  error: "No pudimos completar el acceso. Intentá nuevamente o contactá al Administrador TOCH.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const configured = Boolean(getSupabaseConfig());
  return (
    <main><section className="welcome" aria-labelledby="login-title">
      <div className="brand" aria-hidden="true">TT</div>
      <p className="eyebrow">Teté · Acceso autorizado</p>
      <h1 id="login-title">TT — Tareas TOCH</h1>
      <p className="description">Ingresá con Google o con tu correo corporativo y contraseña.</p>
      {estado && messages[estado] && <p className="notice" role="status">{messages[estado]}</p>}
      {!configured && <p className="notice">El acceso todavía está en configuración.</p>}
      <form action={signInWithGoogle}><button className="primary-button" disabled={!configured}>Continuar con Google</button></form>
      <ClientPasswordForms configured={configured} />
      <form action={signOut}><button className="text-button" disabled={!configured}>Cerrar sesión actual</button></form>
      <Link className="back-link" href="/">Volver al inicio</Link>
    </section></main>
  );
}
