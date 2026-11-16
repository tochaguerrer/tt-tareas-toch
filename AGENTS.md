# Convenciones de TT — Tareas TOCH (Teté)

- Usar Next.js con TypeScript estricto y App Router. Mantener los componentes de servidor como opción predeterminada.
- Consultar las reglas de negocio aprobadas antes de implementar cualquier comportamiento funcional. Si faltan o son ambiguas, solicitar su definición; no inventar roles, permisos, estados ni cálculos.
- Consultar `docs/README.md` para la referencia a la especificación documental 1.9 del producto 1.0 y sus documentos derivados. Revisar `docs/decisiones-pendientes.md` antes del módulo afectado. El modelo y la matriz son propuestas para revisión: una pregunta abierta no concede permisos ni una propuesta equivale a aprobación.
- Preservar la jerarquía Cliente → Proyecto → Tarea/Ticket → Imputación, sin subtareas; numeración global automática e inmutable; presupuestos solo por proyecto y clasificación facturable obligatoria por imputación.
- Solo horas facturables validadas consumen servicio, con ajustes compensatorios idempotentes. Emitir reportes no genera consumos. Bloquear nuevas horas en tareas cerradas/canceladas y conservar el historial.
- Mantener el historial operativo compartido con clientes autorizados, sin secretos ni moneda; los reportes emitidos son inmutables y su envío es manual. No resolver contradicciones documentales sin aprobación de TOCH.
- Aplicar seguridad por roles con privilegios mínimos y denegación por defecto. Los roles y su matriz de acceso deben surgir de las reglas de negocio aprobadas.
- Verificar autenticación, autorización y acceso al recurso en el servidor en cada operación protegida, incluidas lecturas, Route Handlers y Server Actions. Ocultar controles en la interfaz no es una verificación de permisos.
- Los importes monetarios son exclusivamente para Administradores de TOCH. Evitar enviarlos a clientes no autorizados, incluso en respuestas, propiedades serializadas, exportaciones o registros. Verificar este permiso en el servidor.
- Nunca incluir credenciales, tokens ni secretos reales en código, commits, documentación, pruebas o logs. Usar variables de entorno y mantener `.env.example` con valores vacíos o ficticios. No exponer secretos mediante variables `NEXT_PUBLIC_`.
- Cuando se autorice integrar Supabase, complementar los controles del servidor con políticas RLS; nunca exponer claves privilegiadas al navegador.
- Alcance autorizado actual: Supabase y Google OAuth en desarrollo, autorización y base de roles/RLS; administración de usuarios, roles, alcances, desactivación y transferencia; configuración de dominios por cliente y acceso/formulario de Solicitante externo. Cualquier correo Google verificado de dominio autorizado accede al flujo de solicitudes sin alta individual; los perfiles de gestión conservan autorización previa. No implementar otros módulos operativos ni desplegar. Registrar configuración remota y revisión de migraciones explícitamente; no afirmar pruebas remotas que no se hayan ejecutado.
- Ejecutar lint, TypeScript y build antes de entregar cambios; informar fallos y limitaciones. No hacer merge automático a `main`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
