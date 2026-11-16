export function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (domain.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) {
    throw new Error("Ingresá un dominio, por ejemplo empresa.com, sin @, URL ni comodines.");
  }
  return domain;
}
export function requestInput(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  if (!title || title.length > 200 || !description || description.length > 10000) throw new Error("Completá el título y el detalle dentro de los límites indicados.");
  return { title, description };
}

