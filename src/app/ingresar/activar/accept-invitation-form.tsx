"use client";

import { useActionState, useSyncExternalStore } from "react";
import { acceptClientInvitation } from "./actions";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readInvitation() {
  return new URLSearchParams(window.location.hash.slice(1)).get("invitacion") ?? "";
}

export function AcceptInvitationForm() {
  const token = useSyncExternalStore(subscribe, readInvitation, () => null);
  const [message, activate, pending] = useActionState(acceptClientInvitation, "");
  if (token === null) return null;
  if (!/^[a-f0-9]{64}\.(?:[a-f0-9]{56}|[a-f0-9]{64})$/.test(token)) {
    return <p role="alert">Abrí el enlace completo que te envió el Administrador TOCH.</p>;
  }

  return <form action={activate} className="account-form">
    <input type="hidden" name="invitation" value={token} />
    <label htmlFor="invite-password">Contraseña</label>
    <input id="invite-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
    <label htmlFor="invite-confirmation">Confirmá la contraseña</label>
    <input id="invite-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
    {message && <p role="alert">{message}</p>}
    <div><button className="primary-button" disabled={pending}>Completar alta</button></div>
  </form>;
}
