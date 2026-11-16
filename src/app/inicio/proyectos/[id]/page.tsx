import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/admin/account-input";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  redirect(`/inicio/tareas?proyecto=${id}`);
}
