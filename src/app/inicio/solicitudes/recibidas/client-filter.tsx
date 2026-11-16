"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ClientFilter({ clientId, reference, action, children }: {
  clientId: string;
  reference: string;
  action: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return <select id="cliente" name="cliente" defaultValue={clientId} key={clientId}
    onChange={event => {
      const params = new URLSearchParams();
      if (event.currentTarget.value) params.set("cliente", event.currentTarget.value);
      if (reference) params.set("referencia", reference);
      router.push(params.size ? `${action}?${params}` : action, { scroll: false });
    }}>
    {children}
  </select>;
}
