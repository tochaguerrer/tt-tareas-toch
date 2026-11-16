"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { AccountRecord } from "@/lib/admin/account-input";
import { transferAdministration } from "../actions";

export function TransferForm({ accounts }: { accounts: AccountRecord[] }) {
  const [state, action, pending] = useActionState(transferAdministration, { error: "" });
  const [target, setTarget] = useState("");
  const account = accounts.find((item) => item.id === target);
  return <form className="account-form" action={action}>
    <label htmlFor="transfer-target">Cuenta que recibirá la administración</label>
    <select id="transfer-target" name="target_id" required value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Seleccionar cuenta</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}</select>
    <input type="hidden" name="expected_updated_at" value={account?.updated_at ?? ""} />
    {accounts.length === 0 && <p className="notice">Primero autorizá otra cuenta y verificá que haya ingresado con Google. Solo se puede transferir a una cuenta activa que ya ingresó.</p>}
    <p className="notice">La cuenta elegida pasará a Administrador TOCH con acceso global, incluidos usuarios, permisos e información económica. Tu cuenta quedará desactivada y se cerrará tu sesión. El nuevo administrador podrá volver a autorizarte con el perfil que corresponda.</p>
    <label className="check-label"><input name="confirm_transfer" type="checkbox" required key={target} />Confirmo la transferencia a {account?.email ?? "la cuenta seleccionada"} y la desactivación de mi cuenta.</label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div className="form-actions"><button className="primary-button" disabled={pending || !account}>{pending ? "Transfiriendo…" : "Transferir administración y cerrar sesión"}</button><Link href="/inicio/usuarios">Cancelar</Link></div>
  </form>;
}
