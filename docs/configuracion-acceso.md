# Configuración de Supabase y Google en desarrollo

Estado: migración de cuentas/roles/RLS y bootstrap aplicados el 2 de noviembre de 2026 en desarrollo, con autorización explícita de TOCH en el chat. Proveedor Google, Site URL y callback configurados. Ingreso real a `/inicio` como `ariel.guerrero@toch-la.com`, rol Administrador TOCH, y persistencia al recargar verificados el mismo día. No hay despliegues ni módulos operativos. Proyecto: `ztclphzgljttkstftacn`, «Proyecto Teté».

## Qué incluye esta entrega

- Ingreso Google mediante Supabase SSR y PKCE; sesión por cookies y renovación mediante `src/proxy.ts`.
- Callback con destino fijo, sin redirecciones arbitrarias desde parámetros del usuario.
- `/inicio` valida identidad con `getUser()` y consulta autorización vigente en base de datos en cada petición. Un JWT o dominio corporativo por sí solos no habilitan acceso.
- Cuenta autorizada previamente y activa, vinculada al UUID de Auth tras verificar identidad Google y correo. Desactivar cuenta o retirar roles impide acceso sin esperar vencimiento del JWT.
- Cuatro roles autenticados; Solicitante externo sigue siendo actor del formulario futuro, sin cuenta obligatoria ni acceso de navegación.
- Migración con RLS sobre cuentas, asignaciones y auditoría; lectura propia o del Administrador TOCH y escrituras únicamente mediante RPC autorizada. Sin moneda, módulos de negocio ni archivos de clientes.
- La base inicial incluye `admin_set_account`; la entrega de [administración de usuarios](administracion-usuarios.md) reemplaza su acceso directo por RPC versionadas y agrega la interfaz. Requiere la migración `202611020002_user_administration.sql` (aplicada el 03/11/2026; ver `registro-migraciones-20261103.md`).

La base no implementa todavía acceso a tareas/proyectos/horas: las columnas UUID de alcance en `access_grants` quedan reservadas. Al incorporar entidades se deben agregar claves foráneas, políticas y pruebas sobre datos reales de esos módulos. Las pruebas actuales de aislamiento verifican cuentas y asignaciones; no certifican módulos inexistentes.

## Variables locales

Copiar `.env.example` a `.env.local` y completar únicamente URL del proyecto, clave publicable y `APP_URL`. En este checkout se configuró la conexión con valores leídos del panel; `.env.local` está ignorado por Git. La aplicación rechaza claves que no tengan formato publicable.

Usar `APP_URL=http://127.0.0.1:3000` y abrir siempre ese mismo origen durante las pruebas. No alternar con `localhost`: las cookies PKCE pertenecen al host que inició el acceso.

El Client Secret de Google se ingresa directamente en Supabase, nunca en el repositorio, chat o variables `NEXT_PUBLIC_`. La aplicación no requiere `service_role` ni contraseña de PostgreSQL.

## Base de datos de desarrollo

Revisar antes de aplicar, en este orden:

1. `supabase/migrations/202611020001_access_foundation.sql`.
2. `supabase/bootstrap-admin.sql`, una sola vez como propietario de la base. Correo inicial: `ariel.guerrero@toch-la.com`, editable en el script antes de la primera ejecución.

La migración se ejecuta en una transacción y no incluye borrados de datos existentes. Se diseñó como migración versionada de una sola aplicación; no volver a ejecutarla sobre las mismas tablas. Si se usa SQL Editor manualmente, registrar archivo y fecha de aplicación; antes de adoptar Supabase CLI reconciliar su historial para no repetirla.

### Registro de aplicación remota

Aplicados desde SQL Editor del proyecto `ztclphzgljttkstftacn` el 2 de noviembre de 2026. Ambos terminaron con «Success. No rows returned.»; PostgreSQL remoto 17.11. No volver a ejecutarlos. No se registraron automáticamente en `supabase_migrations`; reconciliar antes de usar CLI.

| Archivo | SHA256 del archivo aplicado |
| --- | --- |
| `202611020001_access_foundation.sql` | `6A2EA92192BEEEB260E5AB0E0F91AE32B344043394928919A56C0891D1FA9B3C` |
| `bootstrap-admin.sql` | `D49EF47E81A221377EC760571DEC75A7D314F911835D01DE2711069459F32F10` |

Verificación remota por consultas de catálogo y datos: tres tablas con RLS activo y tres políticas; `anon` sin SELECT sobre cuentas ni EXECUTE sobre `get_my_access`; `authenticated` sin UPDATE directo sobre asignaciones. Cuenta `ariel.guerrero@toch-la.com` activa con `toch_admin`, aún sin UUID Auth vinculado: la vinculación ocurre al primer acceso Google verificado. No se crearon usuarios Google, clientes ni datos ficticios en la base remota.

Una transferencia posterior del rol se realiza autorizando primero la nueva cuenta y modificando luego las asignaciones, mediante `admin_set_account` en contexto de un Administrador TOCH autenticado. No cambiar ni confiar en un correo fijo del código. El acceso de SQL Editor corresponde al propietario del proyecto y no es una prueba de los permisos de un usuario final. La UI de administración aún no existe.

Ejemplo de RPC para esa futura interfaz de servidor, después de comprobar Administrador TOCH en el servidor:

```ts
await supabase.rpc("admin_set_account", {
  p_email: "nuevo-admin@example.test",
  p_active: true,
  p_grants: [{ role: "toch_admin", client_id: null, project_id: null }],
});
```

La RPC revalida el permiso en PostgreSQL y registra valores previos/nuevos y actor. No hay un endpoint público de autoalta. La migración de administración de usuarios incorpora la regla confirmada por TOCH: impedir desactivar o quitar el rol al último Administrador TOCH activo. Ver `administracion-usuarios.md` para su estado de aplicación.

## Google Cloud y Supabase Auth

Proyecto Google Cloud de desarrollo: `tt-tareas-toch-desarrollo`, nombre «TT Tareas TOCH Desarrollo», organización `toch-la.com`. TOCH confirmó explícitamente su uso en el chat el 2 de noviembre de 2026. La consola confirmó la creación de la configuración OAuth con nombre de aplicación «TT — Tareas TOCH» y correo de soporte/contacto `ariel.guerrero@toch-la.com`; audiencia externa en modo de prueba.

La consola confirmó la creación del cliente «Teté Web - Desarrollo», tipo aplicación web, el 2 de noviembre de 2026, con el origen y callback indicados abajo. ID público: `308837948366-jmetervoq5lorjakqa28h6n8bob2t2pp.apps.googleusercontent.com`. El Client Secret no se guarda en el repositorio; su ingreso en Supabase se deja al responsable directamente en el panel. La configuración del proveedor Google, la clasificación del cliente como aplicación web de usuarios, los usuarios de prueba y los redirects de Supabase aún deben verificarse antes de probar el ingreso.

En Google Cloud, crear o seleccionar el proyecto y configurar Google Auth Platform para Teté:

1. Nombre «TT — Tareas TOCH» y datos de contacto de TOCH.
2. Considerar audiencia externa porque el producto incluye usuarios Google de empresas cliente. En modo de prueba, agregar explícitamente las cuentas que probarán el acceso.
3. Scopes de identidad: `openid`, email y perfil. Sin acceso a Gmail ni Drive.
4. Cliente OAuth de tipo aplicación web. Origen local: `http://127.0.0.1:3000`.
5. URI de redirección autorizada de Google: `https://ztclphzgljttkstftacn.supabase.co/auth/v1/callback`.

El responsable debe crear/ingresar las credenciales OAuth y completar los consentimientos. En Supabase → Authentication → Sign In / Providers → Google, ingresar Client ID y Client Secret y habilitar Google. Conservar activas las validaciones de nonce y correo. No confundir este acceso de los usuarios con la cuenta GitHub usada para administrar el panel Supabase.

En Authentication → URL Configuration:

- Site URL: `http://127.0.0.1:3000`.
- Redirect URL permitida exacta: `http://127.0.0.1:3000/auth/callback`.

Ambos valores fueron guardados el 2 de noviembre de 2026; el panel confirmó «Successfully updated site URL» y «Successfully added 1 URL». La prueba iniciada desde `/ingresar` alcanzó el selector de cuenta y el consentimiento de Google con el Client ID previsto y scopes email/profile. Falta confirmar el consentimiento por el responsable y verificar el retorno, vinculación Auth y rol en `/inicio`. No se inspeccionó ni copió el secreto guardado por el usuario.

No usar comodines amplios. La primera autenticación OAuth puede crear una identidad en Supabase Auth, pero no le concede acceso a Teté: requiere cuenta preautorizada, activa y con roles. No deshabilitar altas de Auth sin un mecanismo alternativo de aprovisionamiento, porque impediría el primer ingreso OAuth incluso de cuentas preautorizadas. El código y la base deniegan sesiones de proveedores distintos de Google; revisar los proveedores habilitados antes de producción.

## Pruebas

### Diagnóstico del primer retorno OAuth

El 2 de noviembre de 2026, el primer retorno falló antes de crear la sesión de Teté. Se consultaron los registros remotos `auth_logs`: Google devolvió `invalid_client` con «The provided client secret is invalid.». Debe corregirse el Client Secret del cliente web correspondiente directamente en Supabase y volver a iniciar un flujo OAuth nuevo. No se modificaron roles ni RLS por este error. No conservar códigos OAuth ni secretos en este registro.

Después de que el responsable corrigiera el secreto, Google devolvió un código válido al callback. Se detectó un segundo fallo local: Node devolvía `UNABLE_TO_VERIFY_LEAF_SIGNATURE` al conectar con Supabase. La misma consulta a `/auth/v1/settings` respondió HTTP 200 al usar el almacén de certificados del sistema. Los scripts `dev` y `start` incorporan `node --use-system-ca` para conservar este ajuste al reiniciar, con validación TLS activa. No desactivar `NODE_TLS_REJECT_UNAUTHORIZED`. Referencia: [configuración de redes corporativas de Node.js](https://nodejs.org/learn/http/enterprise-network-configuration).

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm test` ejecuta PostgreSQL embebido con PGlite y datos ficticios: aplica la migración, simula los roles PostgreSQL y funciones de identidad de Supabase, comprueba RLS, revocación, autorización previa, restricciones del Administrador de Contrato y denegación de autoescalamiento. No utiliza claves, red ni datos del proyecto remoto. No reemplaza la revisión humana de RLS ni las pruebas con el servicio real.

Prueba manual después de aplicar y configurar el entorno remoto:

1. Abrir `http://127.0.0.1:3000/ingresar` y continuar con Google.
2. Ingresar con el correo inicial autorizado; comprobar `/inicio` y su rol.
3. Cerrar sesión; `/inicio` debe volver a exigir acceso.
4. Probar otra cuenta Google sin autorización: no debe acceder a `/inicio` ni leer cuentas por Data API.
5. Autorizar cuentas ficticias por rol/alcance y repetir la matriz; desactivar una cuenta con sesión vigente y comprobar rechazo.
6. Comprobar que la sesión se renueva y que errores de callback no exponen códigos/tokens.

## Fuentes técnicas oficiales

### Resultado de verificación del 2 de noviembre de 2026

- `pnpm test`: 11 pruebas aprobadas, incluyendo bootstrap editable, políticas RLS, scopes, revocación, correo verificado y configuración de orígenes/claves.
- `pnpm lint`, `pnpm typecheck` y `pnpm build`: correctos.
- HTTP local: `/` y `/ingresar` devuelven 200; `/inicio` sin sesión redirige a `/ingresar?estado=no-autorizado` y no muestra el correo inicial.
- Pantalla de ingreso inspeccionada visualmente en el navegador.
- `.env.local` confirmado fuera de seguimiento por `.gitignore`.
- Migración y bootstrap remotos aplicados y comprobados según el registro anterior. Google sigue deshabilitado; TOCH confirmó que aún no existe cliente OAuth. No se ejecutó autenticación Google real ni prueba de aislamiento con usuarios reales.

Estas comprobaciones no certifican todavía la configuración Google/Supabase real ni políticas de módulos operativos futuros.

Actualización tras corregir el secreto y la confianza TLS local: la prueba real completó Google → Supabase → callback de Teté → `/inicio`, mostró el correo autorizado y el rol Administrador TOCH y conservó acceso tras recargar. Esto verifica la integración real de la cuenta inicial; aún no certifica pruebas remotas de todos los roles, revocación real, renovación tras vencimiento del token ni aislamiento de módulos futuros. La sesión del responsable quedó abierta; no se exportaron cookies ni tokens.

- [Supabase SSR y renovación de cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).
- [Google OAuth con Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
- [RLS y privilegios PostgreSQL](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Reversión

Ante fallos de la configuración, retirar temporalmente acceso desde la aplicación y revisar en desarrollo. No ejecutar un `DROP ... CASCADE` ni borrar usuarios reales como reversión automática. La migración no tiene rollback destructivo empaquetado: antes de retirar estas tablas se necesita inventario de dependencias y respaldo. Los tests usan bases embebidas desechables.


## Ingreso de clientes por código de correo

Este apartado registra la implementación de la migración 015. El flujo vigente está en [Invitación manual](#invitación-manual-de-colaboradores).

En el primer ingreso por código, la migración 015 autoriza el alta automática como Colaborador Cliente para un correo verificado cuyo dominio exacto está habilitado y corresponde a un cliente externo activo. La cuenta queda vinculada a ese cliente y el alta se registra en auditoría. Un Administrador de Contrato cliente requiere asignación individual previa al mismo cliente. Las cuentas desactivadas y los roles internos quedan bloqueados para el ingreso por código.

La migración 015 se revisó y aplicó el 14/11/2026 mediante el Editor SQL de Proyecto Teté de desarrollo. Se verificó que ambas funciones públicas existen y que solo el rol autenticado, entre los roles de aplicación, tiene permiso de ejecutar la activación. SHA-256 del archivo revisado: 7E78B1517B041B999213511729D90425B3F625C530D8EDAA181A9CD23B2A9E21. Pendiente: configurar el proveedor Email de Supabase Auth, la plantilla Magic Link con el código de seis dígitos mediante la variable de plantilla correspondiente y SMTP para entregar correo a usuarios de prueba externos. Verificar recepción, alta y consulta de solicitudes propias con una cuenta del dominio habilitado. El envío y el ingreso por código con una cuenta externa siguen pendientes de prueba remota.

## Autoalta de clientes con contraseña provisoria

Registro histórico de la migración 016. La migración 017 reemplaza la emisión de contraseñas provisorias por invitación manual y conserva la finalización de sesiones provisorias ya emitidas que sigan vigentes.

El primer ingreso crea el alta individual como **Colaborador Cliente**. Teté valida que el dominio exacto del correo esté habilitado y pertenezca a un cliente externo activo. La persona recibe una contraseña provisoria en ese correo y debe cambiarla en el primer ingreso.

Después del alta, el **Administrador TOCH** puede agregar el rol de **Encargado de cliente** (Administrador de Contrato cliente) al colaborador de esa misma empresa. La persona conserva su cuenta y su rol de Colaborador Cliente.

La migración 016 implementa el alta al primer ingreso válido con la contraseña provisoria y la combinación de roles en la misma empresa. La contraseña provisoria vence a las 24 horas. Una nueva solicitud puede reemplazarla después de dos minutos mientras el cambio de contraseña esté pendiente. Durante la sesión provisoria, la persona puede consultar el título y el detalle de sus propias solicitudes. El cambio de contraseña habilita el espacio de trabajo.

La migración 016 se aplicó mediante el Editor SQL de Proyecto Teté de desarrollo con RLS habilitada. Se verificaron RLS en la tabla de altas, las funciones de alta y cambio de contraseña y el permiso de reserva para el servidor. El archivo local incluye la activación explícita de RLS para reproducir el esquema aplicado.

Queda verificar con correo real la entrega a un dominio habilitado, el primer ingreso, el cambio obligatorio y la posterior asignación de Encargado de cliente.


## Invitación manual de colaboradores

Aplicar la migración 017 después de la 016 en el proyecto Supabase de desarrollo. La ruta requiere el proveedor Email de Supabase, la clave de servidor `TETE_SUPABASE_SECRET_KEY` y `APP_URL` con el origen desde el que el invitado puede abrir Teté. Para pruebas en el mismo equipo, se puede usar `http://127.0.0.1:3000`. Desde otro equipo se requiere un origen HTTPS accesible al destinatario. La invitación manual funciona sin Resend ni cambios al DNS.

En **Usuarios y permisos → Invitar colaborador cliente**, el Administrador TOCH genera y copia un enlace para un correo de dominio habilitado de un cliente externo activo. Lo envía desde su correo habitual. El enlace se puede usar una vez y vence cuando lo hace el token de Supabase o a las 24 horas, lo que ocurra primero. El enlace queda invalidado si el administrador genera uno nuevo. No compartir el enlace fuera del correo del destinatario.

Al abrirlo, la persona elige su contraseña y Teté completa el alta como Colaborador Cliente. Los siguientes ingresos se hacen con correo y contraseña. El Administrador TOCH puede agregar después el rol de Encargado de cliente para esa misma empresa.

La migración 017 se aplicó en Proyecto Teté de desarrollo mediante el Editor SQL de Supabase, que confirmó la ejecución sin errores. Queda pendiente probar el alta completa con una cuenta externa.


## Conversión de solicitudes en tareas

La migración 018 se aplicó en Proyecto Teté de desarrollo mediante el Editor SQL de Supabase. Se verificó que la función de conversión exige un proyecto existente. La función valida que esté activo y pertenezca al cliente de la solicitud.


## Administración de proyectos

La migración 019 se aplicó en Proyecto Teté de desarrollo el 15/11/2026 mediante el Editor SQL de Supabase. Se verificaron la columna de horas presupuestadas, la función de alta y la política de acceso al valor hora con RLS habilitada.


## Alcance global del Administrador TOCH

La migración 020 se aplicó en Proyecto Teté de desarrollo el 15/11/2026 mediante el Editor SQL de Supabase. Se verificó en la definición remota de la función de gestión de tareas que el rol Administrador TOCH habilita la toma, el cierre y la asignación a administradores sin asignaciones específicas de cliente o proyecto.
