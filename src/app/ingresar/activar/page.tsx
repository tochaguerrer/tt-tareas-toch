import Link from "next/link";
import { AcceptInvitationForm } from "./accept-invitation-form";

export default function ActivateClientPage() {
  return <main><section className="welcome">
    <h1>Activá tu cuenta</h1>
    <p className="description">Elegí una contraseña de al menos 12 caracteres.</p>
    <AcceptInvitationForm />
    <Link className="back-link" href="/ingresar">Volver al ingreso</Link>
  </section></main>;
}
