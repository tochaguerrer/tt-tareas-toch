"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveHours } from "./actions";
import { manualHoursToSeconds } from "./duration";

export function HoursFilterCheckbox({ checked, toggleHref, label }: { checked: boolean; toggleHref: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return <label className="hours-filter-checkbox">
    <input type="checkbox" checked={checked} disabled={pending}
      onChange={() => startTransition(() => router.replace(toggleHref, { scroll: false }))} />
    {label}
  </label>;
}

export function HoursForm({ children, operation, id, label, autosave = false, onSaved }: {
  children?: ReactNode; operation: string; id?: string; label: string; autosave?: boolean; onSaved?: () => void;
}) {
  const [message, action, pending] = useActionState(async (previous: string, form: FormData) => {
    const result = await saveHours(previous, form);
    if (result === "Guardado.") onSaved?.();
    return result;
  }, "");
  const scheduled = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(scheduled.current), []);
  return <form action={action} className="form-actions"
    onSubmit={() => window.clearTimeout(scheduled.current)}
    onChange={autosave ? event => {
      if (event.target instanceof HTMLInputElement && event.target.type === "search") return;
      const form = event.currentTarget;
      window.clearTimeout(scheduled.current);
      if (!pending && form.matches(":valid")) {
        scheduled.current = window.setTimeout(() => {
          if (form.isConnected && form.matches(":valid") && form.closest("dialog")?.open !== false) {
            form.requestSubmit();
          }
        }, 1200);
      }
    } : undefined}>
    <input type="hidden" name="operation" value={operation} />
    {id && <input type="hidden" name="id" value={id} />}
    {children}
    <button type="submit" className="primary-button" disabled={pending}>{label}</button>
    <span role="status">{pending ? "Guardando…" : message}</span>
  </form>;
}

export function HoursCell({ taskId, taskLabel, day, total }: {
  taskId: string; taskLabel: string; day: string; total: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState("");
  const [draftId, setDraftId] = useState<string>();
  const [detail, setDetail] = useState("");
  const [billable, setBillable] = useState("");
  const valid = manualHoursToSeconds(duration) !== null;
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full", timeZone: "UTC",
  }).format(new Date(day + "T00:00:00Z"));

  function openDraft() {
    if (!valid) return;
    if (!draftId) setDraftId(crypto.randomUUID());
    dialog.current?.showModal();
  }

  return <>
    <div className="hours-cell-input" data-has-time={Boolean(total)}>
      <input type="text" inputMode="decimal" placeholder={total || "0.0"} maxLength={4} value={duration}
        aria-label={`Horas para ${taskLabel}, ${dateLabel}, en pasos de media hora${total ? `. Registrado: ${total}` : ""}`}
        onChange={event => setDuration(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") openDraft(); }} />
      <button type="button" disabled={!valid} onClick={openDraft}
        aria-label={`Añadir imputación para ${taskLabel}, ${dateLabel}`}>+</button>
    </div>
    <dialog ref={dialog} className="hours-draft-dialog" aria-label="Nueva imputación">
      <h2>Nueva imputación</h2>
      <p>{taskLabel} · {dateLabel} · {duration} h</p>
      {draftId && <HoursForm operation="draft" id={draftId} label="Guardar borrador" autosave onSaved={() => {
        dialog.current?.close();
        setDraftId(undefined);
        setDuration("");
        setDetail("");
        setBillable("");
      }}>
        <input type="hidden" name="task" value={taskId} />
        <input type="hidden" name="date" value={day} />
        <input type="hidden" name="hours" value={duration} />
        <label>Detalle (opcional) <input name="detail" maxLength={5000} value={detail}
          onChange={event => setDetail(event.target.value)} /></label>
        <label>Clasificación <select name="billable" required value={billable}
          onChange={event => setBillable(event.target.value)}>
          <option value="">Seleccionar</option>
          <option value="yes">Facturable</option>
          <option value="no">No facturable</option>
        </select></label>
      </HoursForm>}
      <button type="button" className="text-button" onClick={() => dialog.current?.close()}>Volver a la planilla</button>
    </dialog>
  </>;
}

export function TimerClock({ since, elapsed }: { since: string | null; elapsed: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!since) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [since]);
  const seconds = elapsed + (since && now ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0);
  return <output>{String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}</output>;
}

function normalizeTaskSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

export function TaskPicker({ options, selected }: {
  options: { id: string; label: string }[]; selected?: string;
}) {
  const [query, setQuery] = useState("");
  const [task, setTask] = useState(selected ?? "");
  const terms = normalizeTaskSearch(query).trim().split(/\s+/).filter(Boolean);
  const matches = options.filter(option => {
    const label = normalizeTaskSearch(option.label);
    return terms.every(term => label.includes(term));
  });
  return <>
    <label>Buscar tarea por ID o nombre
      <input type="search" value={query} onChange={event => {
        setQuery(event.target.value);
        setTask("");
      }} />
    </label>
    <label>Tarea <select name="task" value={task} onChange={event => setTask(event.target.value)}
      size={terms.length && matches.length ? Math.min(6, matches.length + 1) : undefined} required>
      <option value="">{matches.length ? "Seleccionar tarea" : "No hay tareas disponibles"}</option>
      {matches.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    {terms.length > 0 && <span className="field-help" role="status">
      {matches.length === 0 ? "Ninguna tarea coincide con la búsqueda." : `${matches.length} ${matches.length === 1 ? "tarea encontrada" : "tareas encontradas"}`}
    </span>}
  </>;
}
