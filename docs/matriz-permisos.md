# Matriz de permisos de Teté

El perfil **Colaborador Cliente** se asigna individualmente a una empresa externa. Puede presentar solicitudes y consultar las que presentó, junto con sus tareas derivadas, estado, respuestas y adjuntos. Puede publicar respuestas y adjuntar archivos en sus propias tareas mientras no estén cerradas. El Encargado de Contrato conserva la lectura de todas las solicitudes y tareas de su empresa.

Estado: catálogo de cinco perfiles confirmado por el responsable TOCH el 2 de noviembre de 2026. La matriz detallada de acciones sigue en revisión. Se preparó código y migración para autorización de acceso, roles y alcances; no se implementan todavía los permisos de los módulos operativos. Fuente: especificación documental 1.9 y confirmación en el chat; referencias en [índice](README.md).

## Perfiles y alcance

| Perfil | Alcance confirmado | Acceso monetario |
| --- | --- | --- |
| Administrador TOCH | Global, configuración y administración económica | Exclusivo |
| Gerente de Cuenta TOCH | Clientes asignados y sus proyectos | Prohibido |
| Colaborador TOCH | Proyectos asignados y todas sus tareas; sin autorizaciones a tareas individuales | Prohibido |
| Administrador de Contrato cliente | Exactamente una empresa cliente: todas sus solicitudes, proyectos, tickets y horas; lectura y presentación de solicitudes | Prohibido |
| Solicitante externo | Formulario de solicitud con correo verificado y dominio autorizado; sin navegación de gestión | Prohibido |

Fuente: tabla de roles confirmada por TOCH, §4, §9.1 y §19 sobre enlaces. El Solicitante externo accede al flujo de solicitudes por correo verificado de dominio autorizado, sin alta individual previa; no obtiene navegación de gestión. Ver la confirmación de acceso por dominio al final de este documento. TOCH confirmó que «Encargado de Cliente» en §12 equivale a Gerente de Cuenta TOCH dentro de sus clientes asignados (D-01 resuelta); no es un sexto perfil.

El Administrador de Contrato cliente es la contrapartida del Gerente de Cuenta TOCH del lado del cliente. Son roles independientes con permisos diferentes: el primero consulta solicitudes, tickets y horas de su empresa y puede enviar solicitudes; el segundo gestiona la cuenta desde TOCH. Esta relación no otorga al cliente permisos de administración operativa, aprobación de horas ni acceso monetario. Confirmado por TOCH en el chat el 2 de noviembre de 2026.

TOCH confirmó en el chat el 2 de noviembre de 2026 que el Colaborador accede a todas las tareas de sus proyectos asignados, sin permisos individuales por tarea. El Administrador de Contrato cliente consulta todas las solicitudes, proyectos, tickets y horas de su empresa, siempre sin información monetaria (D-10 resuelta).

## Acciones

TOCH confirmó el 2 de noviembre de 2026 la combinación Gerente de Cuenta TOCH + Colaborador TOCH: una misma persona puede gestionar sus clientes asignados e imputar sus propias horas en proyectos autorizados. También confirmó que el Gerente puede aprobar sus propias imputaciones en proyectos de sus clientes asignados, aunque requieran aprobación. Registrar aprobador, fecha y la trazabilidad de la validación individual. Cada función conserva su alcance y no concede acceso monetario.

Una persona puede tener más de un rol, confirmado por TOCH el 2 de noviembre de 2026. Ejemplo confirmado: Administrador de Contrato cliente y Solicitante externo. Puede consultar la información de su empresa y presentar solicitudes; actuar como solicitante no exige una segunda cuenta ni concede acceso de gestión adicional. El Administrador de Contrato siempre está vinculado a exactamente una empresa cliente y no puede representar varias, aun teniendo varias asignaciones. La composición general de otros roles sigue pendiente en D-11. Esta restricción no modifica el alcance de clientes asignados del Gerente de Cuenta TOCH.

«Pendiente» indica que el documento no define suficientemente la acción o su alcance; no concede acceso. «Sin permiso definido» tampoco constituye autorización. Hasta resolverlo se aplica denegación por defecto.

| Acción | Administrador TOCH | Gerente de Cuenta | Colaborador | Admin. Contrato cliente | Solicitante externo | Fuente |
| --- | --- | --- | --- | --- | --- | --- |
| Administrar usuarios, roles y autorizaciones | Exclusivo | No | No | No | No | §4, §8; confirmación TOCH 02/11/2026 |
| Dar de alta clientes y configurar dominios | Exclusivo | No | No | No | No | §1, §8; D-12 parcialmente resuelta, confirmación TOCH 02/11/2026 |
| Crear proyectos y gestionar presupuesto en horas | Sí | Clientes asignados | No | No | No | §4, §5.1, CA-11 |
| Crear tareas en proyecto existente | Sí | Clientes asignados | Proyecto autorizado | No | No | §5.1 |
| Consultar ficha e historial operativo | Global | Clientes asignados | Todas las tareas de proyectos asignados | Todas las tareas de su empresa | No | §14, §19; D-10 resuelta |
| Comentar, responder y adjuntar | Sí, sujeto a controles de contenido | Dentro de alcance operativo | Tareas de proyectos asignados | Solo lectura | No | §4, §14, §18; D-10 resuelta |
| Registrar horas e iniciar temporizador | Sí, en tarea abierta | En alcance autorizado y tarea abierta | En alcance autorizado y tarea abierta | No | No | §5, §6, §16 |
| Cerrar tarea | No por este rol | No | No | Su empresa | No | Decisión del 03/11/2026 |
| Reabrir tarea con motivo | Sí | Clientes asignados, con motivo y auditoría | No | No | No | §12.3; D-01 resuelta |
| Cancelar, reasignar o mover tarea | Sí, dentro de administración global | Permiso específico pendiente | Permiso específico pendiente | No | No | §4, §5, §19; D-12 |
| Aprobar horas por imputación | Sí | Proyectos de clientes asignados que requieren aprobación, incluidas sus propias horas | No por el solo rol Colaborador | No | No | §12.1, §12.12; D-01; confirmación TOCH 02/11/2026 |
| Corregir clasificación propia antes de validación/corte | Sí | Propia en alcance | Propia no aprobada ni incluida en cierre | No | No | §12.2, §16 |
| Corregir clasificación después de validación/corte | Sí, con motivo y auditoría | Autoriza en clientes asignados, con motivo y auditoría; ejecución pendiente D-13 | Requiere autorización; ejecución pendiente | No | No | §12.2; D-01 resuelta; D-13 |
| Corregir duración, fecha o anular imputación | Administración global; procedimiento pendiente | Pendiente | Pendiente | No | No | §12.12; D-13 |
| Presentar solicitud externa | Flujo externo sujeto a validación | Flujo externo sujeto a validación | Flujo externo sujeto a validación | Sí | Sí, dominio habilitado y correo verificado | §4, §5.2 |
| Revisar/rechazar/vincular solicitudes | Sí | Clientes asignados | No | No | No | §5.2, §8 |
| Preparar borrador mensual | Sí | Clientes asignados, solo horas | No | No | No | RF-RM-01 |
| Emitir/rectificar informe oficial y descargar para envío manual | Exclusivo | No | No | No | No | RF-RM-04, §12.10 |
| Consultar informe emitido | Sí | Acceso al emitido no explicitado | No | Su cliente | No | RF-RM-04; D-12 |
| Exportar PDF de ficha | Generación autorizada por alcance | Perfil exportador pendiente | Perfil exportador pendiente | Perfil exportador pendiente | No | §14; D-12 |
| Consultar economía, tarifas, costos o rentabilidad | Exclusivo | No | No | No | No | §4, §7.3 |

La sección 12 confirma quién puede autorizar correcciones posteriores, pero no define si las ejecuta el supervisor o si habilita al colaborador para hacerlo. Tampoco atribuye permisos generales de edición de horas a todos los participantes de una tarea.

## Controles que deberá cumplir la implementación

- Exigir autorización previa de cada correo por el Administrador TOCH, con rol y alcance, para los perfiles de gestión. El Solicitante externo queda exceptuado: accede al flujo de solicitudes mediante correo verificado y dominio autorizado. Google verifica identidad; no concede acceso automáticamente. Confirmado por TOCH el 2 de noviembre de 2026. El formulario externo mantiene su flujo independiente.
- Inicializar el Administrador TOCH con `ariel.guerrero@toch-la.com` mediante configuración controlada; la asignación debe poder editarse o transferirse a otra cuenta autorizada por un Administrador TOCH. No codificar una excepción permanente para ese correo.

- Validar usuario activo, rol, alcance y recurso en servidor y base de datos. Una cuenta de dominio TOCH no recibe permisos automáticamente (§9.1).
- Proteger también búsquedas, totales, previews de enlaces, metadatos, errores, archivos, exportaciones y notificaciones; conocer un ID no concede acceso (§19).
- Mantener tablas y consultas económicas separadas; las fichas operativas y PDFs no incluyen moneda incluso para el Administrador (§14).
- Autorizar adjuntos por tarea y usar almacenamiento privado y enlaces temporales. Los permisos de Drive siguen siendo propios del recurso (§12.6).
- Restringir menciones a usuarios autorizados a participar o consultar la tarea (§18).
- Aplicar el alcance por proyecto del Colaborador y por empresa del Administrador de Contrato cliente (D-10 resuelta). Resolver composición de roles antes de escribir políticas: D-11.

## Casos de aceptación para las próximas etapas

1. Usuario de Cliente A no obtiene registros, adjuntos, informes ni previews de Cliente B mediante URL directa o API.
2. Gerente asignado a A no obtiene datos de B ni campos monetarios de A.
3. Colaborador asignado a un proyecto consulta todas sus tareas, pero no las de proyectos no asignados. No existe concesión de acceso por tarea individual.
4. Admin. de Contrato consulta la ficha compartida, pero no modifica tareas, comentarios ni horas.
5. Solicitante con correo verificado presenta una solicitud; eso no le permite navegar tickets.
6. Usuario desactivado deja de operar aunque conserve una sesión previa.
7. El responsable puede cambiar el estado operativo; solo el Administrador de Contrato puede cerrar tareas de su empresa. El responsable no puede reabrir por el solo hecho de ser responsable.

Los criterios sobre módulos operativos siguen pendientes. La entrega de acceso incluye pruebas de la migración y RLS con PostgreSQL embebido sobre cuentas y asignaciones, con identidad Supabase simulada. La migración remota fue aplicada y se verificó el acceso Google real de la cuenta inicial de Administrador TOCH, incluida persistencia tras recargar. Las pruebas con otros usuarios reales y todos los roles aún están pendientes; ver `configuracion-acceso.md`.
## Acceso del Solicitante externo por dominio — confirmado 02/11/2026

TOCH confirmó en el chat que cualquier persona con un correo verificado de un dominio autorizado puede acceder al flujo de solicitudes del cliente asociado, sin autorización individual previa del Administrador TOCH. La habilitación del dominio sigue siendo exclusiva del Administrador TOCH. El cliente se determina en el servidor por el dominio habilitado, no por una selección libre del solicitante.

Este acceso permite presentar solicitudes; no concede gestión de proyectos, tareas, horas ni información monetaria. La solicitud conserva el flujo de revisión y vinculación a tarea existente; no equivale a crear directamente una tarea operativa. Puede coexistir con Administrador de Contrato cliente sin duplicar la identidad ni ampliar sus permisos.

La excepción a la preautorización individual se limita al flujo de Solicitante externo. Los perfiles de gestión conservan su autorización explícita. El acceso por dominio, formulario y administración de dominios tienen código y migraciones aplicadas en desarrollo desde el 03/11/2026; el panel administrativo se verificó sin cargar dominios reales. Ver [estado de la entrega](solicitante-externo.md).
