"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ProjectFilter({ projectId, children, id = "task-project", path = "/inicio/tareas", filters }: {
  projectId: string;
  children: ReactNode;
  id?: string;
  path?: string;
  filters?: Record<string, string>;
}) {
  const router = useRouter();

  return <select id={id} name="proyecto" defaultValue={projectId} key={projectId}
    onChange={event => {
      const project = event.currentTarget.value;
      const search = new URLSearchParams(filters);
      if (project) search.set("proyecto", project);
      router.push(search.size ? `${path}?${search}` : path, { scroll: false });
    }}>
    {children}
  </select>;
}
