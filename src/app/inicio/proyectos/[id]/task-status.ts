const labels: Record<string, string> = {
  pending: "Pendiente",
  development: "Desarrollo",
  test: "Test",
  client_query: "Consulta Cliente",
  in_progress: "En progreso",
  waiting: "En espera",
  resolved: "Resuelta",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export function taskStatusLabel(status: string) {
  return Object.hasOwn(labels, status) ? labels[status] : status;
}
