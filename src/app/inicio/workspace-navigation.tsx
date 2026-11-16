"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavigationItem = { href: string; label: string; icon: string };

export function WorkspaceNavigation({ items, signOut }: {
  items: NavigationItem[];
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const inHours = pathname === "/inicio/horas";
  const [defaultCollapsed, setDefaultCollapsed] = useState(false);
  const [hoursMenu, setHoursMenu] = useState({ inHours, collapsed: true });
  if (hoursMenu.inHours !== inHours) setHoursMenu({ inHours, collapsed: true });
  const collapsed = inHours ? hoursMenu.collapsed : defaultCollapsed;
  const active = items.findLast(({ href }) => pathname === href ||
    (href !== "/inicio" && pathname.startsWith(href + "/")));
  const toggleLabel = collapsed ? "Expandir menú" : "Colapsar menú";

  return <aside className="workspace-sidebar" data-collapsed={collapsed}>
    <div className="workspace-sidebar-header">
      <strong>Teté</strong>
      <button type="button" className="workspace-toggle" aria-label={toggleLabel} title={toggleLabel}
        aria-expanded={!collapsed} aria-controls="workspace-menu" onClick={() => {
          if (inHours) setHoursMenu({ inHours, collapsed: !collapsed });
          else setDefaultCollapsed(!collapsed);
        }}>
        {collapsed ? "›" : "‹"}
      </button>
    </div>
    <nav id="workspace-menu" aria-label="Navegación principal">
      {items.map(({ href, label, icon }) => <Link key={href} href={href} title={collapsed ? label : undefined}
        aria-current={active?.href === href ? "page" : undefined}>
        <span className="workspace-icon" aria-hidden="true">{icon}</span>
        <span className="workspace-label">{label}</span>
      </Link>)}
      <form action={signOut}>
        <button type="submit" title={collapsed ? "Cerrar sesión" : undefined}>
          <span className="workspace-icon" aria-hidden="true">↪</span>
          <span className="workspace-label">Cerrar sesión</span>
        </button>
      </form>
    </nav>
  </aside>;
}
