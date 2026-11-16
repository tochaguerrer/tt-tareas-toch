import Link from "next/link";
import { loadAccounts, requireAdmin } from "@/lib/admin/accounts";
import { roleLabels } from "@/lib/auth/policy";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string; estado?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").slice(0, 254).trim();
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  const { accounts, count } = await loadAccounts(query, page);
  function pageLink(value: number) { return `/inicio/usuarios?${new URLSearchParams({ q: query, pagina: String(value) })}`; }
  return <main className="admin-main"><section className="admin-panel" aria-labelledby="users-title">
    <Link className="back-link" href="/inicio">← Inicio de Teté</Link>
    <div className="section-heading"><div><p className="eyebrow">Administración TOCH</p><h1 id="users-title">Usuarios y permisos</h1></div><Link className="primary-button" href="/inicio/usuarios/nuevo">Autorizar correo</Link></div>
    <p><Link href="/inicio/usuarios/invitar">Invitar colaborador cliente</Link></p>
    <p className="description">Administrá quién puede ingresar y con qué alcance. Los colaboradores invitados pueden ingresar con su correo y contraseña.</p>
    <p><a href="/inicio/usuarios/exportar" download>Descargar listado completo (CSV para Excel)</a></p>
    {params.estado === "guardado" && <p className="notice" role="status">Los permisos se guardaron correctamente.</p>}
    <form className="account-search" action="/inicio/usuarios"><label htmlFor="search-email">Buscar por correo</label><div><input id="search-email" type="search" name="q" defaultValue={query} maxLength={254} /><button className="primary-button">Buscar</button><Link href="/inicio/usuarios">Limpiar</Link></div></form>
    <p className="field-help">{count} {count === 1 ? "cuenta" : "cuentas"} · Página {page}</p>
    {accounts.length === 0 ? <p className="notice">No hay cuentas para esta búsqueda.</p> : <ul className="account-list">{accounts.map((account) => <li key={account.id}>
      <div><Link className="account-email" href={`/inicio/usuarios/${account.id}`}>{account.email}</Link><p>{[...new Set(account.grants.map((grant) => roleLabels[grant.role]))].join(" · ") || "Sin perfil"}</p><p className="field-help">{account.has_signed_in ? "Cuenta vinculada" : "Pendiente de primer ingreso"}</p></div>
      <span className={`account-status ${account.is_active ? "active" : ""}`}>{account.is_active ? "Habilitada" : "Desactivada"}</span><Link href={`/inicio/usuarios/${account.id}`}>Editar permisos</Link>
    </li>)}</ul>}
    <nav className="pagination" aria-label="Paginación de usuarios">{page > 1 && <Link href={pageLink(page - 1)}>Anterior</Link>}{page * 25 < count && <Link href={pageLink(page + 1)}>Siguiente</Link>}</nav>
    <Link className="back-link" href="/inicio/usuarios/transferir">Transferir mi administración a otra cuenta</Link>
  </section></main>;
}
