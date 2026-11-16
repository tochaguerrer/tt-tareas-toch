"use client";

import { useActionState } from "react";

export function TaskManagementForm({ label, options, current, save, compact = false, autoSave = false }: {
  label: string;
  options?: { value: string; label: string }[];
  current?: string;
  compact?: boolean;
  autoSave?: boolean;
  save: (state: string, form: FormData) => Promise<string>;
}) {
  const [message, action, pending] = useActionState(save, "");
  return <form action={action}>
    {options && <label>{compact ? null : label}
      <select name="value" aria-label={compact ? label : undefined} required defaultValue={current ?? ""} disabled={pending}
        onChange={autoSave ? event => event.currentTarget.form?.requestSubmit() : undefined}>
        <option value="" disabled>Seleccioná una opción</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>}
    {!autoSave && <button type="submit" disabled={pending}>{options ? "Guardar" : label}</button>}
    <p role="status">{autoSave && pending ? "Guardando…" : message}</p>
  </form>;
}
