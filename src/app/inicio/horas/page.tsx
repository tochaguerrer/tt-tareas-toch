import { randomUUID } from "node:crypto";
import Link from "next/link";
import { isUuid } from "@/lib/admin/account-input";
import { ProjectFilter } from "../tareas/project-filter";
import { loadHoursContext, shift } from "./hours-context";
import { HoursCell, HoursFilterCheckbox, HoursForm, TaskPicker, TimerClock } from "./hours-form";
import { formatDecimalHours as duration } from "./duration";
import { taskStatusLabel } from "../proyectos/[id]/task-status";
import { TaskManagementForm } from "../proyectos/task-management-form";
import { updateHoursTaskStatus } from "./task-status-action";

type Task = { id: string; title: string; task_number: number; status: string; responsible_id: string | null;
  is_generic: boolean; project_id: string; client_id: string };
type Entry = { task_id: string; work_date: string; seconds: number; billable: boolean; submitted_at: string | null };
type Timer = { id: string; title: string; finished: boolean; running_since: string | null;
  elapsed_seconds: number; mine: boolean };

function Classification() {
  return <>
    <label>Detalle <input name="detail" required maxLength={5000} /></label>
    <label>Clasificación <select name="billable" required defaultValue="">
      <option value="">Seleccionar</option><option value="yes">Facturable</option><option value="no">No facturable</option>
    </select></label>
  </>;
}

export default async function HoursPage({ searchParams }: {
  searchParams: Promise<{ semana?: string; task?: string; finDeSemana?: string; proyecto?: string; cerradas?: string; cerrada?: string | string[] }>;
}) {
  const params = await searchParams;
  const context = await loadHoursContext(params.semana);
  if (!context) return <main className="admin-main"><p>La planilla aún no está habilitada.</p><Link href="/inicio">Volver a Teté</Link></main>;
  const { db, access, admin, manager, accountId, monday, canReview } = context;
  const days = Array.from({ length: 7 }, (_, i) => shift(monday, i));
  const showWeekend = params.finDeSemana === "1";
  const showClosed = params.cerradas === "1";
  const recentlyClosed = new Set([params.cerrada ?? []].flat().filter(isUuid));
  const visibleDays = showWeekend ? days : days.slice(0, 5);
  const projectId = typeof params.proyecto === "string" && isUuid(params.proyecto) ? params.proyecto : "";
  const formatDay = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" });
  const formatRange = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
  let taskQuery = db.from("tasks").select("id,title,task_number,status,responsible_id,is_generic,project_id,client_id");
  if (projectId) taskQuery = taskQuery.eq("project_id", projectId);
  async function loadWeeklyEntries() {
    const entries: Entry[] = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const result = await db.from("time_entries").select("task_id,work_date,seconds,billable,submitted_at")
        .eq("account_id", accountId).gte("work_date", monday).lte("work_date", days[6])
        .order("id").range(offset, offset + batchSize - 1).overrideTypes<Entry[], { merge: false }>();
      if (result.error) throw new Error("No se pudieron cargar las horas de la semana.");
      entries.push(...result.data);
      if (result.data.length < batchSize) return entries;
    }
  }
  const [tasks, own, recent, timers, projects] = await Promise.all([
    taskQuery.order("task_number", { ascending: false }).overrideTypes<Task[], { merge: false }>(),
    loadWeeklyEntries(),
    db.from("time_entries").select("task_id").eq("account_id", accountId).lt("work_date", monday)
      .order("work_date", { ascending: false }).limit(50),
    db.rpc("hours_timers"),
    db.from("projects").select("id,name").order("name").order("id"),
  ]);
  if (tasks.error || recent.error || timers.error || projects.error || !Array.isArray(timers.data)) {
    throw new Error("No se pudo cargar la planilla.");
  }
  const timerRows = timers.data as Timer[];
  const canWork = (t: Task) => canReview(t) ||
    access.grants.some(g => g.role === "collaborator" && g.project_id === t.project_id);
  const open = tasks.data.filter(t => !["closed", "cancelled"].includes(t.status) && canWork(t));
  const selected = open.find(t => t.id === params.task);
  const weekHref = (week: string, weekend: boolean, closed = showClosed) => {
    const query = new URLSearchParams({ semana: week });
    if (weekend) query.set("finDeSemana", "1");
    if (selected) query.set("task", selected.id);
    if (projectId) query.set("proyecto", projectId);
    if (closed) query.set("cerradas", "1");
    return `?${query}`;
  };
  const suggested = new Set([...own.map(e => e.task_id), ...recent.data.map(e => e.task_id)]);
  const statusReturnQuery = new URLSearchParams(weekHref(monday, showWeekend));
  const taskLinkQuery = new URLSearchParams(statusReturnQuery);
  taskLinkQuery.set("desde", "horas");
  for (const taskId of recentlyClosed) statusReturnQuery.append("cerrada", taskId);
  const worked = new Set(own.map(entry => entry.task_id));
  const shown = tasks.data.filter(t => t.status === "closed"
    ? (showClosed || recentlyClosed.has(t.id)) && (canWork(t) || worked.has(t.id))
    : worked.has(t.id) || (open.includes(t) &&
      (suggested.has(t.id) || t.responsible_id === accountId || t.is_generic || t === selected)));
  const editableStatuses = await Promise.all(shown.map(async task => {
    if (!open.includes(task) || (!canReview(task) && task.responsible_id !== accountId)) return [];
    const result = await db.rpc("task_management", { p_task_id: task.id, p_project_id: task.project_id });
    if (result.error || !Array.isArray(result.data?.states)) return [];
    return (result.data.states as string[]).map(value => ({ value, label: taskStatusLabel(value) }));
  }));
  const projectFilters: Record<string, string> = { semana: monday };
  if (showWeekend) projectFilters.finDeSemana = "1";
  if (showClosed) projectFilters.cerradas = "1";
  const running = timerRows.find(t => t.mine && !t.finished);
  const sum = (rows: Entry[], day?: string) => rows.reduce((total, entry) => total + (!day || entry.work_date === day ? entry.seconds : 0), 0);
  const cells = (rows: Entry[], task?: Task) => <>{visibleDays.map(day => {
    const seconds = sum(rows, day);
    const total = duration(seconds, false);
    return <td className="hours-day" key={day}>{task && open.includes(task)
      ? <HoursCell key={`${task.id}-${day}`} taskId={task.id} taskLabel={`#${task.task_number} · ${task.title}`} day={day} total={seconds ? total : ""} />
      : total}</td>;
  })}<td>{duration(sum(rows.filter(e => e.billable)), false)}</td><td>{duration(sum(rows), false)}</td></>;
  const options = open.map(t => ({
    id: t.id,
    label: `#${t.task_number} · ${t.title}${t.is_generic ? " · Genérica" : ""}`,
  }));
  const taskOptions = <TaskPicker key={selected?.id} options={options} selected={selected?.id} />;

  return <main className="admin-main"><section className="admin-panel hours-panel">
    <header className="hours-header"><Link href="/inicio">Volver a Teté</Link><h1>Registros de horas</h1>
      <nav className="hours-links" aria-label="Registros de horas">
        <a href="#planilla">Mi planilla de horas</a>
        <a href="#temporizador">Registrar con temporizador</a>
      </nav>
    </header>
    <div className="hours-toolbar" id="planilla">
      <nav className="hours-week" aria-label="Semana">
        <Link href={weekHref(shift(monday, -7), showWeekend)} aria-label="Semana anterior">‹</Link>
        <strong>{formatRange.format(new Date(monday + "T00:00:00Z"))} – {formatRange.format(new Date(days[6] + "T00:00:00Z"))}</strong>
        <Link href={weekHref(shift(monday, 7), showWeekend)} aria-label="Semana siguiente">›</Link>
      </nav>
      <div className="hours-project-filter">
        <label htmlFor="hours-project">Proyecto</label>
        <ProjectFilter id="hours-project" path="/inicio/horas" projectId={projectId}
          filters={projectFilters}>
          <option value="">Todos los proyectos</option>
          {projects.data.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </ProjectFilter>
      </div>
      <HoursFilterCheckbox label="Mostrar sábado y domingo" checked={showWeekend} toggleHref={weekHref(monday, !showWeekend)} />
      <HoursFilterCheckbox label="Mostrar tareas cerradas" checked={showClosed}
        toggleHref={weekHref(monday, showWeekend, !showClosed)} />
      {own.some(e => !e.submitted_at) && <HoursForm operation="submit" label="Enviar semana">
        <input type="hidden" name="week" value={monday} />
      </HoursForm>}
    </div>
    <div className="task-table-wrap"><table className="task-table hours-grid">
      <thead><tr><th scope="col">Tarea</th><th scope="col">Estado</th>{visibleDays.map(day => {
        const date = new Date(day + "T00:00:00Z");
        const shortDate = formatRange.formatToParts(date)
          .filter(part => part.type === "day" || part.type === "month")
          .map(part => part.value.replace(/\.$/, "")).join(" ");
        return <th className="hours-day" key={day} scope="col">
          <span>{formatDay.format(date).replace(/\.$/, "")}</span>
          <span>{shortDate}</span>
        </th>;
      })}<th scope="col">Tiempo facturable</th><th scope="col">Tiempo total</th></tr></thead>
      <tbody>
        {shown.map((task, index) => <tr key={task.id}><th scope="row">
          <Link href={`/inicio/proyectos/${task.project_id}/tareas/${task.id}?${taskLinkQuery}`}>#{task.task_number} · {task.title}</Link>
        </th>
          <td className="hours-task-status">{editableStatuses[index].length > 0
            ? <TaskManagementForm compact autoSave key={task.status} label={`Estado de la tarea #${task.task_number}`}
                current={task.status} options={[
                  { value: task.status, label: taskStatusLabel(task.status) }, ...editableStatuses[index],
                ]} save={updateHoursTaskStatus.bind(null, task.id, task.project_id, task.status, statusReturnQuery.toString())} />
            : taskStatusLabel(task.status)}</td>
          {cells(own.filter(entry => entry.task_id === task.id), task)}
        </tr>)}
        {shown.length === 0 && <tr><td colSpan={visibleDays.length + 4}>No hay tareas para mostrar.</td></tr>}
      </tbody>
      <tfoot><tr><th scope="row" colSpan={2}>Totales diarios y semanales</th>{cells(own)}</tr></tfoot>
    </table></div>
    <details className="hours-add-task">
      <summary>＋ Agregar tarea</summary>
      <form className="form-actions" action="/inicio/horas">
        <input type="hidden" name="semana" value={monday} />
        {projectId && <input type="hidden" name="proyecto" value={projectId} />}
        {showWeekend && <input type="hidden" name="finDeSemana" value="1" />}
        {showClosed && <input type="hidden" name="cerradas" value="1" />}
        {taskOptions}<button>Mostrar en la planilla</button>
      </form>
    </details>
    <p className="field-help hours-grid-help">Carga manual en pasos de media hora (0,5; 1; 1,5). Presioná Enter para completar la imputación.</p>
    <section className="hours-lower">
    <h2 id="temporizador">Temporizador</h2>
    <p className="field-help">Elegí una tarea e iniciá el reloj para registrar el tiempo trabajado.</p>
    {running ? <>
      <p>{running.title} · {running.running_since ? "En marcha" : "Pausado"} · <TimerClock since={running.running_since} elapsed={running.elapsed_seconds} /></p>
      <HoursForm operation={running.running_since ? "pause" : "resume"} id={running.id} label={running.running_since ? "Pausar" : "Reanudar"} />
      <HoursForm operation="finish" id={running.id} label="Finalizar y guardar"><Classification /></HoursForm>
    </> : <HoursForm operation="start" id={randomUUID()} label="Iniciar">{taskOptions}</HoursForm>}
    {timerRows.filter(t => t.finished).map(t => <div key={t.id}>
      <p>{t.title} · <TimerClock since={null} elapsed={t.elapsed_seconds} /> · Pendiente de clasificación por cierre</p>
      {(admin || manager) && <HoursForm operation="classify" id={t.id} label="Clasificar tiempo"><Classification /></HoursForm>}
    </div>)}
    {selected && canReview(selected) && <HoursForm operation="generic" label={selected.is_generic ? "Quitar marca genérica" : "Designar tarea genérica"}>
      <input type="hidden" name="task" value={selected.id} /><input type="hidden" name="generic" value={selected.is_generic ? "no" : "yes"} />
    </HoursForm>}
    <p><Link href={`/inicio/horas/estado?semana=${monday}`}>Consultar Estado de horas</Link></p>
    </section>
  </section></main>;
}


