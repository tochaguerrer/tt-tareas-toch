import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/auth/access";
import { ConvertForm } from "./convert-form";

import { RequestContent } from '../request-content';
export async function RequestDetail({ id }: { id: string }) {
  const access = await requireAccess();
  const supabase = await createClient();
  const [request, attachments, task] = await Promise.all([
    supabase.from("incoming_requests").select("description,description_document,client_id").eq("id", id).single(),
    supabase.from("request_attachments").select("id,filename").eq("request_id", id).eq("submitted", true).order("filename"),
    supabase.from("tasks").select("id,task_number,title,project_id,status").eq("source_request_id", id).maybeSingle(),
  ]);
  if (request.error || attachments.error) throw new Error("No se pudo abrir la solicitud.");
  const pendingMigration = task.error?.code === "PGRST205" || task.error?.code === "42P01";
  if (task.error && !pendingMigration) throw new Error("No se pudo consultar la tarea vinculada.");
  const canConvert = access.grants.some(grant => grant.role === "toch_admin" ||
    (grant.role === "account_manager" && grant.client_id === request.data.client_id));
  const projects = canConvert && !task.error && !task.data
    ? await supabase.from("projects").select("id,name").eq("client_id", request.data.client_id).eq("is_active", true).order("name")
    : null;
  if (projects?.error) throw new Error("No se pudieron consultar los proyectos.");
  const linkedProject = task.data
    ? await supabase.from("projects").select("name").eq("id", task.data.project_id).maybeSingle()
    : null;
  if (linkedProject?.error) throw new Error("No se pudo consultar el proyecto vinculado.");
  return (
    <article><RequestContent {...request.data} attachments={attachments.data} />
      {task.data ? <>
        <h2>Tarea vinculada</h2>
        <p><Link href={`/inicio/proyectos/${task.data.project_id}/tareas/${task.data.id}`}>#{task.data.task_number} · {task.data.title}</Link></p>
        {linkedProject?.data && <p>Proyecto: {linkedProject.data.name}</p>}
        {task.data.status === "pending" && <p>Estado: Pendiente</p>}
      </> : projects && <ConvertForm id={id} projects={projects.data ?? []} />}
      {canConvert && pendingMigration && <p>La conversión en tarea todavía no está habilitada.</p>}
    </article>
  );
}

