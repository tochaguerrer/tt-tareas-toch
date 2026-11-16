import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/admin/account-input";
import { requireAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { RequestContent } from "@/app/inicio/solicitudes/request-content";
import { taskStatusLabel } from "../../task-status";
import { TaskReplyForm } from "../../../task-reply-form";
import { TaskManagementForm } from "../../../task-management-form";
import { updateTask } from "../../../task-management-action";

type Management = { choices: { id: string; email: string }[]; states: string[];
  responsible: string | null; canAssign: boolean; canTake?: boolean };

export default async function TaskPage({ params, searchParams }: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAccess();
  const { id, taskId } = await params;
  if (!isUuid(id) || !isUuid(taskId)) notFound();
  const supabase = await createClient();
  const task = await supabase.from("tasks").select("task_number,title,status,source_request_id,client_id")
    .eq("id", taskId).eq("project_id", id).maybeSingle();
  if (task.error) throw new Error("No se pudo consultar la tarea.");
  if (!task.data) notFound();
  const clientId = task.data.client_id;
  const ownClient = access.grants.some(grant => grant.role === "client_collaborator");
  const canRegisterHours = access.grants.some(({ role }) =>
    role === "toch_admin" || role === "account_manager" || role === "collaborator");
  const hoursQuery = new URLSearchParams();
  const origin = await searchParams;
  if (origin.desde === "horas") {
    for (const key of ["semana", "proyecto", "finDeSemana", "cerradas", "task"]) {
      const value = origin[key];
      if (typeof value === "string") hoursQuery.set(key, value);
    }
  }
  const hoursHref = hoursQuery.size ? `/inicio/horas?${hoursQuery}` : "/inicio/horas";
  const [management, history] = await Promise.all([
    access.grants.some(grant => grant.role === "toch_admin" ||
      ((grant.role === "account_manager" || grant.role === "client_contract_admin") && grant.client_id === clientId) ||
      (grant.role === "collaborator" && grant.project_id === id))
      ? supabase.rpc("task_management", { p_task_id: taskId, p_project_id: id }) : null,
    supabase.from("task_status_events").select("id,previous_status,status,actor_email,created_at")
      .eq("task_id", taskId).order("id"),
  ]);
  if (history.error && !["PGRST205", "42P01"].includes(history.error.code)) {
    throw new Error("No se pudo consultar el historial.");
  }
  const controls = management?.data as Management | null | undefined;
  const canReply = access.grants.some(grant => grant.role === "toch_admin" ||
    (grant.role === "account_manager" && grant.client_id === clientId) ||
    (grant.role === "collaborator" && grant.project_id === id) || grant.role === "client_collaborator");
  const replies = await supabase.from("task_replies").select("id,author_email,body,filename,created_at")
    .eq("task_id", taskId).order("created_at").order("id");
  if (replies.error && replies.error.code !== "PGRST205" && replies.error.code !== "42P01") {
    throw new Error("No se pudieron consultar las interacciones.");
  }
  const [request, attachments] = await Promise.all([
    supabase.from("incoming_requests").select("reference_number,description,description_document")
      .eq("id", task.data.source_request_id).maybeSingle(),
    supabase.from("request_attachments").select("id,filename")
      .eq("request_id", task.data.source_request_id).eq("submitted", true).order("filename"),
  ]);
  if (request.error || attachments.error) throw new Error("No se pudo consultar el detalle.");
  let content = request.data ? { ...request.data, attachments: attachments.data } : null;
  if (!content) {
    const result = await supabase.rpc("read_task_content", { p_task_id: taskId });
    if (result.error && result.error.code !== "PGRST202") throw new Error("No se pudo consultar el detalle.");
    content = result.data;
  }
  return (
    <main className="admin-main"><section className="admin-panel narrow-panel">
      <Link href={ownClient ? "/inicio/solicitudes/recibidas" : "/inicio/tareas"}>
        {ownClient ? "Volver a mis solicitudes" : "Volver a tareas"}
      </Link>
      {canRegisterHours && <p><Link href={hoursHref}>Volver al registro de Horas</Link></p>}
      <h1>#{task.data.task_number} · {task.data.title}</h1>
      <p>Estado: {taskStatusLabel(task.data.status)}</p>
      {controls?.canTake && <TaskManagementForm label="Tomar tarea"
        save={updateTask.bind(null, taskId, id, "take", "")} />}
      {controls?.canAssign && (controls.choices.length
        ? <TaskManagementForm key={controls.responsible ?? "unassigned"} label="Responsable"
          options={controls.choices.map(option => ({ value: option.id, label: option.email }))}
          current={controls.responsible ?? undefined}
          save={updateTask.bind(null, taskId, id, "assign", controls.responsible ?? "")} />
        : <p>No hay colaboradores activos habilitados para este proyecto.</p>)}
      {!!controls?.states.length && <TaskManagementForm key={task.data.status} label="Cambiar estado"
        options={controls.states.map(status => ({ value: status, label: taskStatusLabel(status) }))}
        save={updateTask.bind(null, taskId, id, "status", task.data.status)} />}
      {request.data && <Link href={`/inicio/solicitudes/recibidas?referencia=${String(request.data.reference_number).padStart(6, "0")}`}>
        Ver solicitud original
      </Link>}
      {content ? <RequestContent {...content} /> : <p>El detalle de esta tarea todavía no está disponible.</p>}
      {!!history.data?.length && <section>
        <h2>Historial de estados</h2>
        <ol>{history.data.map(event => <li key={event.id}>
          {event.previous_status ? taskStatusLabel(event.previous_status) + " → " : ""}
          {taskStatusLabel(event.status)} · {new Intl.DateTimeFormat("es-AR", {
            dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
          }).format(new Date(event.created_at))}
          {event.actor_email && " · " + event.actor_email}
        </li>)}</ol>
      </section>}
      {replies.data && <section>
        <h2>Interacciones</h2>
        {replies.data.length ? <ol>{replies.data.map(reply => <li key={reply.id}>
          <p className="field-help">{reply.author_email} · {new Intl.DateTimeFormat("es-AR", {
            dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
          }).format(new Date(reply.created_at))}</p>
          {reply.body && <p style={{ whiteSpace: "pre-wrap" }}>{reply.body}</p>}
          {reply.filename && <a href={`/inicio/proyectos/adjuntos/${reply.id}`}>{reply.filename}</a>}
        </li>)}</ol> : <p>Todavía no hay respuestas.</p>}
        {canReply && task.data.status !== "closed" && <TaskReplyForm taskId={taskId} projectId={id} />}
      </section>}
    </section></main>
  );
}
