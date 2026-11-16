# Administración de usuarios de Teté

Entrega autorizada por TOCH en el chat el 2 de noviembre de 2026. Código y migración preparados en `feat/configuracion-inicial`; sin despliegue ni merge. Esta entrega no crea ni modifica usuarios reales durante la verificación automática.

## Funciones

- `/inicio/usuarios`: listado paginado de cuentas, búsqueda por correo, estado y perfiles asignados.
- `/inicio/usuarios/nuevo`: autorización previa de un correo Google. El perfil se selecciona explícitamente; no se asigna Administrador por defecto.
- `/inicio/usuarios/{id}`: activar/desactivar y modificar perfiles y alcances. El correo de una identidad no se reasigna: para cambiarlo se autoriza una cuenta nueva y se retira el acceso anterior.
- Revisión visible antes de confirmar cambios; no se envían invitaciones ni correos.
- Gerente de Cuenta con uno o varios clientes, Colaborador con uno o varios proyectos, combinación Gerente + Colaborador y Administrador de Contrato con exactamente una empresa.
- Solicitante externo: acceso automático al flujo de solicitudes por correo verificado de dominio autorizado, sin alta individual; confirmado por TOCH. Migración 003 aplicada el 03/11/2026. Se configura por dominio, no por asignación individual. Ver [flujo externo](solicitante-externo.md).
- `/inicio/usuarios/transferir`: transferencia explícita a otra cuenta activa que ya ingresó con Google. El destinatario pasa a Administrador TOCH; la cuenta origen queda desactivada y su sesión local se cierra. La operación completa es atómica y auditada. Se informa este efecto antes de confirmar.

Todos los datos, pantallas y Server Actions revalidan Administrador TOCH en el servidor. Las RPC vuelven a comprobar el permiso vigente en PostgreSQL; no se usan claves privilegiadas desde la aplicación. Usuarios de otros perfiles no pueden operar llamando directamente a la RPC. Los UUID de Auth no se envían como propiedades al formulario; solo se informa si la cuenta ya ingresó.

## Alcances por cliente y proyecto

La migración agrega tablas mínimas `clients` y `projects` para referencias de autorización y claves foráneas desde las asignaciones. No incluye pantallas de alta de clientes/proyectos, presupuestos, tareas, contratos, moneda ni datos precargados. Esos módulos siguen siendo próximas entregas.

Los formularios usan nombres y selectores de registros existentes, sin pedir UUID manuales. En una base sin clientes o proyectos, los perfiles que necesitan esos alcances no pueden habilitarse hasta cargar los registros correspondientes. Las pruebas crean datos ficticios únicamente en PostgreSQL embebido.

Se valida que un cliente/proyecto exista y esté activo al habilitar una asignación. Para un proyecto, también debe estar activo su cliente. Los scopes inválidos se rechazan incluso mediante llamadas directas.

## Migración

Estado: migración 002 aplicada en «Proyecto Teté» el 03/11/2026, seguida de la 003. Ver [registro de aplicación, hashes y verificaciones](registro-migraciones-20261103.md). No volver a ejecutar ni repetir el bootstrap.

Archivo: `supabase/migrations/202611020002_user_administration.sql`. Aplicar solo después de `202611020001_access_foundation.sql`, una vez, en desarrollo y tras revisar el cambio.

- Crea referencias mínimas de clientes y proyectos, RLS de lectura por alcance y claves foráneas.
- Retira el endpoint inicial sin control de versión: `admin_set_account` se renombra a `admin_set_account_legacy` y se revoca su ejecución a usuarios de API. Solo las nuevas funciones privilegiadas pueden reutilizarlo.
- `admin_save_account` valida identidad del actor, correo, alcances, duplicados y versión `updated_at`. Si otra operación cambió la cuenta, rechaza la edición en vez de sobrescribirla.
- `admin_transfer_administration` comprueba identidad verificada del destinatario, promueve al destinatario, desactiva al origen y registra auditoría en una transacción.
- Las operaciones administrativas se serializan para evitar carreras entre cambios y transferencias. Desactivar una cuenta impide nuevas operaciones aunque conserve un JWT anterior.

Antes de aplicar, comprobar si existen asignaciones de cliente/proyecto heredadas: las nuevas claves foráneas requieren que sus registros existan. No crear datos ficticios ni eliminar asignaciones para forzar la migración. No ejecutar el bootstrap inicial nuevamente. Registrar aplicación manual y hash antes de reconciliar el historial con Supabase CLI.

TOCH confirmó que no se puede desactivar ni quitar el rol al último Administrador TOCH activo. La RPC aplica esa protección dentro del bloqueo transaccional, incluso ante llamadas directas. La transferencia sigue siendo posible porque primero promueve al destinatario activo con primer ingreso completado y luego desactiva al origen, todo en la misma transacción.

## Verificación

`pnpm test` incluye pruebas de migración completa con PGlite: permiso exclusivo, denegación del endpoint anterior, aislamiento de clientes/proyectos, asignaciones válidas/invalidas, contrato con cliente único, concurrencia por versión, desactivación y transferencia atómica, incluido un fallo simulado tardío con rollback completo.

Las pruebas SQL simulan identidad de Supabase; no reemplazan las pruebas con cuentas Google de cada perfil. No se realizan transferencias ni altas de personas reales como prueba de interfaz sin indicación específica.

Flujo manual después de aplicar la migración: ingresar como Administrador, abrir «Administrar usuarios», buscar una cuenta, revisar su formulario y cancelar para verificar navegación sin cambios. Las pruebas de alta, baja y transferencia remotas deben usar cuentas de prueba autorizadas expresamente.

