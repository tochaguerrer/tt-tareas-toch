"use client";

import { useActionState } from "react";
import { replyToTask } from "./task-reply-action";

export function TaskReplyForm({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [error, action, pending] = useActionState(replyToTask.bind(null, taskId, projectId), "");
  return (
    <form action={action} className="account-form">
      <label htmlFor="reply-body">Respuesta</label>
      <textarea id="reply-body" name="body" maxLength={5000} rows={4} />
      <label htmlFor="reply-file">Adjunto opcional (hasta 512 KB)</label>
      <input id="reply-file" type="file" name="attachment" />
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={pending}>{pending ? "Publicando…" : "Publicar respuesta"}</button>
    </form>
  );
}
