"use client";

import { useActionState, useState } from "react";
import { generateClientInvitation } from "./actions";

export function InvitationForm() {
  const [result, generate, pending] = useActionState(generateClientInvitation, {});
  const [copiedLink, setCopiedLink] = useState("");

  return <>
    <form className="account-form" action={generate}>
      <label htmlFor="invite-email">Correo corporativo del colaborador</label>
      <input id="invite-email" name="email" type="email" autoComplete="off" maxLength={254} required />
      <div><button className="primary-button" disabled={pending}>Generar invitación</button></div>
    </form>
    {!pending && result.message && <p role="status">{result.message}</p>}
    {!pending && result.link && <div className="account-form">
      <p>Enviá este enlace a {result.email} desde tu correo habitual. El enlace vence y se puede usar una vez.</p>
      <label htmlFor="invite-link">Enlace de invitación</label>
      <input id="invite-link" type="text" value={result.link} onFocus={(event) => event.currentTarget.select()} readOnly />
      <div><button className="primary-button" type="button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(result.link!);
          setCopiedLink(result.link!);
        } catch {
          document.getElementById("invite-link")?.focus();
        }
      }}>Copiar enlace</button></div>
      {copiedLink === result.link && <p role="status">Enlace copiado.</p>}
    </div>}
  </>;
}
