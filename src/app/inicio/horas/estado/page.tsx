import Link from "next/link";
import { formatDecimalHours } from "../duration";
import { loadHoursContext, shift } from "../hours-context";
import { HoursForm } from "../hours-form";

type Entry = {
  id: string;
  task_id: string;
  account_id: string;
  work_date: string;
  seconds: number;
  detail: string;
  billable: boolean;
  submitted_at: string | null;
  approved_at: string | null;
};

type Task = { id: string; title: string; client_id: string };

export default async function HoursStatusPage({ searchParams }: {
  searchParams: Promise<{ semana?: string; task?: string; finDeSemana?: string }>;
}) {
  const params = await searchParams;
  const context = await loadHoursContext(params.semana);
  if (!context) return <main className="admin-main">
    <p>El estado de horas aún no está habilitado.</p>
    <Link href="/inicio/horas">Volver a Registro de horas</Link>
  </main>;

  const { db, admin, manager, accountId, monday, canReview } = context;
  const sunday = shift(monday, 6);
  const entriesQuery = db.from("time_entries")
    .select("id,task_id,account_id,work_date,seconds,detail,billable,submitted_at,approved_at")
    .gte("work_date", monday).lte("work_date", sunday)
    .order("work_date").order("id");
  const scopedEntries = admin || manager
    ? entriesQuery.or(`account_id.eq.${accountId},and(submitted_at.not.is.null,approved_at.is.null)`)
    : entriesQuery.eq("account_id", accountId);
  const entries = await scopedEntries.overrideTypes<Entry[], { merge: false }>();
  if (entries.error) throw new Error("No se pudo cargar el estado de horas.");
  const taskIds = [...new Set(entries.data.map(entry => entry.task_id))];
  const tasks = taskIds.length
    ? await db.from("tasks").select("id,title,client_id").in("id", taskIds).overrideTypes<Task[], { merge: false }>()
    : { data: [], error: null };
  if (tasks.error) throw new Error("No se pudieron cargar las tareas de las imputaciones.");

  const taskById = new Map(tasks.data.map(task => [task.id, task]));
  const own = entries.data.filter(entry => entry.account_id === accountId);
  const toApprove = entries.data.filter(entry => {
    const task = taskById.get(entry.task_id);
    return entry.submitted_at && !entry.approved_at && task && canReview(task);
  });

  function weekQuery(week: string) {
    const query = new URLSearchParams({ semana: week });
    if (params.finDeSemana === "1") query.set("finDeSemana", "1");
    if (typeof params.task === "string") query.set("task", params.task);
    return `?${query}`;
  }

  return <main className="admin-main"><section className="admin-panel">
    <Link href={`/inicio/horas${weekQuery(monday)}`}>Volver a Registro de horas</Link>
    <h1>Estado de horas</h1>
    <nav className="hours-week" aria-label="Semana">
      <Link href={weekQuery(shift(monday, -7))} aria-label="Semana anterior">‹</Link>
      <strong>{monday} al {sunday}</strong>
      <Link href={weekQuery(shift(monday, 7))} aria-label="Semana siguiente">›</Link>
    </nav>
    <h2>Mis imputaciones pendientes</h2>
    <EntryList entries={own.filter(entry => !entry.approved_at)} tasks={taskById} />
    <h2>Mis imputaciones aprobadas</h2>
    <EntryList entries={own.filter(entry => entry.approved_at)} tasks={taskById} />
    {(admin || manager) && <>
      <h2>Horas por aprobar</h2>
      <EntryList entries={toApprove} tasks={taskById} review />
    </>}
  </section></main>;
}

function EntryList({ entries, tasks, review = false }: {
  entries: Entry[];
  tasks: Map<string, Task>;
  review?: boolean;
}) {
  return entries.length ? <ul>{entries.map(entry => <li key={entry.id}>
    {entry.work_date} · {tasks.get(entry.task_id)?.title} · {formatDecimalHours(entry.seconds)}
    {entry.detail && ` · ${entry.detail}`} · {entry.billable ? "Facturable" : "No facturable"}
    {!review && !entry.approved_at && (entry.submitted_at ? " · En revisión" : " · Borrador")}
    {review && <HoursForm operation="approve" id={entry.id} label="Aprobar imputación" />}
  </li>)}</ul> : <p>Sin imputaciones en esta semana.</p>;
}
