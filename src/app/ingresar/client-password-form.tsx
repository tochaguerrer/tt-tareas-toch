"use client";

import { useActionState } from "react";
import { changeTemporaryPassword, signInClientPassword } from "./client-password-actions";

export function ClientPasswordForms({ configured }: { configured: boolean }) {
  const [loginMessage, login, signingIn] = useActionState(signInClientPassword, "");
  return <form action={login} className="account-form">
      <label htmlFor="client-email">Correo corporativo</label>
      <input id="client-email" name="email" type="email" autoComplete="username" maxLength={254} required />
      <label htmlFor="client-password">Contraseña</label>
      <input id="client-password" name="password" type="password" autoComplete="current-password" required />
      {loginMessage && <p role="alert">{loginMessage}</p>}
      <div><button className="primary-button" disabled={!configured || signingIn}>Ingresar</button></div>
    </form>;
}

export function ChangeTemporaryPasswordForm() {
  const [message, action, pending] = useActionState(changeTemporaryPassword, "");
  return <form action={action} className="account-form">
    <label htmlFor="temporary-password">Contraseña provisoria</label>
    <input id="temporary-password" name="current_password" type="password" autoComplete="current-password" required />
    <label htmlFor="new-password">Nueva contraseña</label>
    <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
    <label htmlFor="confirm-password">Confirmá la nueva contraseña</label>
    <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
    {message && <p role="alert">{message}</p>}
    <div><button className="primary-button" disabled={pending}>Cambiar contraseña</button></div>
  </form>;
}
