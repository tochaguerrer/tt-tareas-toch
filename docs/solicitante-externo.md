# Solicitudes externas por dominio

Regla confirmada por TOCH el 02/11/2026: cualquier persona con correo verificado de un dominio habilitado puede presentar solicitudes para el cliente asociado, sin autorización individual previa. La administración de dominios es exclusiva del Administrador TOCH.

## Entrega local

- `/inicio/dominios`: alta mínima de clientes (nombre y tipo), autorización de dominios y habilitación/deshabilitación, con confirmación explícita del alcance. No incluye gestión de proyectos ni contratos.
- `/ingresar`: Google verifica la identidad. Los permisos de gestión continúan requiriendo autorización individual; el acceso de solicitante se deriva del dominio.
- `/inicio/solicitudes`: título y detalle de solicitud, cliente y remitente determinados en el servidor. Confirmación de recepción; reintentar el mismo envío no duplica la solicitud.
- El solicitante no consulta tickets, horas, otros solicitantes ni montos. La solicitud queda almacenada para revisión futura; todavía no se convierte en tarea ni se envían correos.
- El Administrador de Contrato conserva su asignación única y puede coexistir con el acceso de solicitante por dominio sin otra cuenta. El formulario implementado en esta etapa exige dominio habilitado también para esa identidad.

La configuración coincide con el dominio exacto normalizado a minúsculas. No autoriza subdominios implícitamente ni admite URLs, arrobas o comodines. Los nombres internacionalizados deben ingresarse en su forma ASCII (punycode). Un dominio activo corresponde a un único cliente. No se precargan dominios reales.

La identidad proviene de Google y de los registros verificados de Supabase Auth, nunca de metadatos editables o de campos de correo/cliente enviados por el navegador. Una cuenta explícitamente desactivada no recupera acceso por dominio. Deshabilitar el dominio o su cliente bloquea nuevos envíos aun con sesión anterior. Las solicitudes existentes se conservan.

## Migraciones y estado remoto

Las migraciones 001, 002 y 003 están aplicadas en desarrollo. Las migraciones 002 y 003 se aplicaron en orden el 03/11/2026 con autorización explícita de TOCH; ver [registro y verificaciones](registro-migraciones-20261103.md). No repetirlas ni ejecutar el bootstrap nuevamente. El panel de dominios ya carga con la sesión de Administrador.

La migración 003 agrega `client_domains`, `incoming_requests`, RPC administrativas y de envío, y actualiza `get_my_access`. RLS y privilegios impiden DML directo; el solicitante no puede listar las solicitudes. La lectura operativa queda limitada al Administrador TOCH, Gerente asignado y Administrador de Contrato del cliente. No hay pantallas de revisión, rechazo o vinculación en esta entrega.

Para probar remotamente: entrar como Administrador, abrir «Clientes y dominios», agregar el cliente real y autorizar su dominio. Luego ingresar con una cuenta Google verificada de ese dominio y enviar una solicitud. Utilizar cuentas y dominios de prueba autorizados, sin habilitar dominios públicos compartidos como prueba. No se crearon personas, clientes ni dominios reales durante la verificación.

El proveedor Google debe permitir el ingreso de esas cuentas. Si el cliente OAuth continúa en modo de pruebas de Google Cloud, sus restricciones y usuarios de prueba también se aplican; habilitar un dominio en Teté no modifica esa configuración de Google.

## Verificación

TOCH confirmó el 03/11/2026 que la configuración de Clientes y Dominios y el acceso por dominio funcionaron en su prueba. Detectó la falta de formato, capturas y adjuntos; la corrección y la migración 004 se documentan en [editor de solicitudes](editor-solicitudes.md).

Pruebas SQL locales con PGlite y mocks de identidad Supabase: acceso sin alta individual, ausencia de autoasignación de roles de gestión, aislamiento de datos, dominio exacto, correo verificado, rechazo de proveedor no Google, revocación individual y por dominio/cliente, cliente/remitente calculados en servidor, idempotencia, rechazo de DML directo y dominio activo único. Se ejecutan también las pruebas anteriores de roles y último administrador.

La prueba real con otra cuenta Google de cliente permanece pendiente. Las migraciones remotas están aplicadas y el panel administrativo fue verificado. No se publicaron despliegues ni se hizo merge.
