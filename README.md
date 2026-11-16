# TT — Tareas TOCH (Teté)

Versión 1.0 del sistema corporativo de gestión de clientes, proyectos, tareas, colaboración y horas de servicio de TOCH.

## Estado actual

Base con Next.js, TypeScript estricto, App Router y ESLint. La pantalla inicial presenta el nombre formal del sistema y Teté. Acceso Google con Supabase, autorización previa en servidor y base de cuentas/roles/RLS aplicados en desarrollo. Primer ingreso real y persistencia tras recargar verificados con la cuenta inicial de Administrador TOCH el 2 de noviembre de 2026. No hay módulos operativos ni despliegues.

Tecnologías aprobadas: Supabase PostgreSQL, Auth y Storage; Google OAuth; Vercel Pro. La integración de identidad en desarrollo está autorizada. Seguir [configuración de acceso](docs/configuracion-acceso.md) para migración, Google Cloud y panel Supabase. Storage y despliegue se incorporarán en próximas etapas.

## Requisitos e instalación

- Node.js 22.18 o superior (verificado con Node.js 24; las pruebas utilizan soporte nativo de TypeScript).
- pnpm 11.25.0. Si no está instalado y tenés npm: `npm install --global pnpm@11.25.0`.

Desde la raíz del repositorio:

```powershell
pnpm install --frozen-lockfile
```

La bienvenida pública funciona sin variables. Para autenticación, copiá `.env.example` con `Copy-Item .env.example .env.local` y completá la URL Supabase, clave publicable y `APP_URL`. Los archivos de entorno locales están excluidos de Git. No usar claves privilegiadas. La configuración de Google se hace en Supabase, no en estas variables.

## Ejecución local

```powershell
pnpm dev
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000), el origen local configurado para OAuth. Deben aparecer «TT — Tareas TOCH», «Hola, soy Teté.» y el botón de ingreso. `/ingresar` inicia el acceso; `/inicio` requiere cuenta habilitada. Otros entornos necesitan completar los pasos remotos documentados. Los comandos `dev` y `start` usan los certificados de confianza del sistema para HTTPS (`--use-system-ca`), necesario en este equipo para conectar con Supabase. Detené el servidor con `Ctrl+C`.

## Verificaciones

```powershell
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

`typecheck` genera los tipos de rutas de Next.js y ejecuta TypeScript sin emitir archivos. El lint se ejecuta por separado del build, según la [documentación de Next.js](https://nextjs.org/docs/app/getting-started/installation).

Limitación conocida: ESLint 9.39.5 aparece marcado como fuera de soporte en el registro. Se conserva porque los plugins de importaciones, React y accesibilidad incluidos por `eslint-config-next` todavía declaran compatibilidad hasta ESLint 9. La prueba con ESLint 10 produjo incompatibilidades de dependencias pares. Revisar esta actualización cuando esos plugins admitan la nueva versión.

Para probar la compilación de producción:

```powershell
pnpm build
pnpm start
```

## Estructura

- `src/app/page.tsx`: pantalla inicial.
- `src/app/layout.tsx`: idioma, metadatos y layout principal.
- `src/app/globals.css`: estilos adaptables, sin fuentes ni recursos externos.
- `AGENTS.md`: convenciones de seguridad, permisos y consulta de reglas de negocio.
- `.env.example`: plantilla sin credenciales.
- `eslint.config.mjs`, `tsconfig.json` y `next.config.ts`: configuración técnica.
- `pnpm-lock.yaml`: versiones resueltas; conservarlo en Git.

## Documentación funcional y diseño

El [editor de solicitudes](docs/editor-solicitudes.md) incorpora fuentes, color, texto enriquecido, capturas pegadas y archivos privados. La migración 202611030004_request_rich_content.sql está aplicada en Proyecto Teté. Las migraciones 002 y 003 ya están aplicadas.

El [flujo de Solicitante externo](docs/solicitante-externo.md) incorpora configuración de clientes/dominios en `/inicio/dominios` y formulario en `/inicio/solicitudes`. Cualquier correo Google verificado de dominio autorizado puede presentar solicitudes sin alta individual; no recibe permisos de gestión. Las migraciones 002 y 003 se aplicaron en Supabase el 03/11/2026; panel administrativo, tablas, RLS y privilegios remotos verificados. Ver el [registro de aplicación](docs/registro-migraciones-20261103.md). No se habilitaron dominios reales ni se crearon solicitudes reales de prueba.

La [administración de usuarios](docs/administracion-usuarios.md) incorpora listado, autorización de correos, perfiles, desactivación y transferencia. La migración `202611020002_user_administration.sql` está aplicada en Supabase desde el 03/11/2026, incluida la protección del último Administrador activo. Los alcances requieren clientes/proyectos existentes; no se crean registros ficticios.

La especificación documental 1.9 (producto 1.0) fue revisada. El [índice de diseño](docs/README.md) reúne la matriz de permisos, el modelo de datos propuesto y las decisiones pendientes. Estos documentos están para revisión; no constituyen funcionalidades implementadas ni aprobación de las propuestas.

## Seguridad y colaboración

Consultar `AGENTS.md` y las reglas de negocio aprobadas antes de implementar funcionalidades. Verificar permisos en el servidor; los importes monetarios son exclusivamente para Administradores de TOCH. Nunca versionar credenciales.

La preparación se realiza en `feat/configuracion-inicial`, sin merge automático a `main`.

Repositorio previsto: [Toch-Latin-America/tt-tareas-toch](https://github.com/Toch-Latin-America/tt-tareas-toch). Al inspeccionar este checkout, `origin` apuntaba a `https://github.com/tochaguerrer/tt-tareas-toch.git`; se conserva sin cambios. Confirmar el destino antes de un futuro push.
