# Diseño funcional y técnico de Teté

Estado: propuesta para revisión, preparada el 2 de noviembre de 2026. Producto 1.0; especificación documental 1.9 del 29 de octubre de 2026.

Este conjunto documenta las reglas extraídas de la especificación y las propuestas para implementarlas. No autoriza funcionalidades adicionales ni resuelve decisiones comerciales o de permisos pendientes.

## Fuente y precedencia

Fuente funcional: `Tete_Especificacion_Funcional_Tecnica_V1_9_DESCARGA (1).docx`, entregada por el responsable TOCH. Ubicación local de referencia: carpeta superior a este repositorio, `C:/Documents/TOCH/Clientes/TOCH/001) Ticket TOCH/`. No se copia el documento al repositorio ni se depende de esa ruta para ejecutar la aplicación.

Las referencias de sección en estos documentos corresponden a esa revisión. Sus reglas confirmadas, especialmente la sección 12, son la base funcional. Las diferencias entre secciones se registran para resolución explícita, sin elegir silenciosamente una interpretación. Las instrucciones de implementación contenidas en la especificación no amplían por sí mismas el alcance autorizado en el chat.

La etapa actual incluye, por autorización explícita en el chat, la integración de Supabase y Google OAuth en desarrollo y la base de autorización/RLS. Migración, alta inicial y proveedor Google configurados; ingreso real como Administrador TOCH y persistencia al recargar verificados el 2 de noviembre de 2026. No se implementan módulos operativos ni despliegues. Ver [configuración de acceso](configuracion-acceso.md).

## Documentos de revisión

- [Editor y adjuntos de solicitudes](editor-solicitudes.md): corrección de formato, capturas, archivos y migración 004 aplicada.

- [Registro de migraciones 002 y 003](registro-migraciones-20261103.md): aplicación remota del 03/11/2026, hashes y verificación de permisos y panel.

- [Solicitante externo](solicitante-externo.md): acceso por dominio verificado, configuración por Administrador, formulario, migración y estado de verificación.

- [Matriz de permisos](matriz-permisos.md): alcance por perfil, acciones confirmadas y vacíos de autorización.
- [Modelo de datos propuesto](modelo-datos.md): entidades, relaciones, invariantes y operaciones atómicas.
- [Decisiones pendientes](decisiones-pendientes.md): contradicciones, parámetros y preguntas para TOCH.
- [Configuración de acceso](configuracion-acceso.md): integración, migración, configuración remota y pruebas de desarrollo.
- [Administración de usuarios](administracion-usuarios.md): pantallas, reglas, migración y verificación de autorización, permisos y transferencia.

## Reglas confirmadas principales

### Alta y acceso inicial confirmados

TOCH confirmó en el chat el 2 de noviembre de 2026:

- La cuenta inicial de Administrador TOCH será `ariel.guerrero@toch-la.com`.
- La asignación de ese rol será editable por un Administrador TOCH y transferible a otra cuenta autorizada; no fijar el correo como condición de autorización en el código.
- Cada correo debe estar autorizado previamente por el Administrador TOCH, con su rol y alcance. Autenticarse con Google no habilita acceso por sí solo.
- Proyecto Supabase de desarrollo identificado: `ztclphzgljttkstftacn`, «Proyecto Teté». Migración, alta inicial, proveedor Google y conexión local configurados. Acceso con la cuenta inicial de Administrador verificado el 02/11/2026.

La autorización individual previa se aplica a los perfiles de gestión. TOCH confirmó que cualquier persona con correo verificado de dominio autorizado puede acceder como Solicitante externo al flujo del cliente asociado, sin alta individual. El flujo tiene código y migraciones aplicadas en desarrollo; falta cargar un cliente/dominio autorizado y probar con otra cuenta Google. Ver el registro del 03/11/2026.

El responsable TOCH confirmó el 2 de noviembre de 2026 el catálogo: Administrador TOCH, Gerente de Cuenta TOCH, Colaborador TOCH, Solicitante externo y Administrador de Contrato cliente, con los alcances de la matriz. Solo el Administrador TOCH accede a montos monetarios. «Encargado de Cliente» de §12 equivale a Gerente de Cuenta TOCH dentro de sus clientes asignados (D-01 resuelta).

El Administrador de Contrato cliente es la contrapartida del Gerente de Cuenta TOCH del lado del cliente. Mantiene un perfil independiente de lectura de solicitudes, tickets y horas de su empresa, con posibilidad de enviar solicitudes. La relación de contrapartida no implica igualdad de permisos operativos.

D-10 fue confirmada por TOCH el 2 de noviembre de 2026: el Colaborador accede a todas las tareas de los proyectos asignados, sin autorizaciones por tarea individual. El Administrador de Contrato cliente consulta todas las solicitudes, proyectos, tickets y horas de su empresa, sin información monetaria.

TOCH confirmó también que una persona puede tener varios roles, por ejemplo Administrador de Contrato cliente y Solicitante externo. El Administrador de Contrato siempre corresponde a exactamente una empresa cliente, nunca a varias. D-11 queda parcialmente resuelta; falta precisar la composición general de otras combinaciones de roles.

- Cliente → Proyecto → Tarea/Ticket → Imputación. TOCH es cliente interno. Sin subtareas (§2).
- Ticket con UUID técnico y número entero global, creciente, automático e inmutable. Admite saltos y nunca reutiliza números (§15).
- Presupuesto opcional solo por proyecto; estimaciones de tarea no reservan saldo (§7).
- Cada imputación pertenece a una tarea y colaborador, conserva segundos reales y clasificación facturable obligatoria (§6, §16).
- Aprobación por imputación, configurable por proyecto. Solo horas facturables validadas generan consumo contractual; cambios producen ajustes compensatorios idempotentes (§12).
- Cierre/cancelación bloquean nuevas horas incluso retroactivas; cierre detiene temporizadores transaccionalmente. Reapertura supervisada con motivo (§5, §12).
- Historial operativo y comentarios únicos, compartidos con clientes autorizados. Sin secretos ni datos económicos (§12.11, §14).
- Reportes con estado histórico al corte, snapshots inmutables y rectificaciones versionadas. Descarga y envío manual; emitir no consume horas (§8 bis, §12).
- Solo Administrador TOCH accede a moneda, tarifas, costos y rentabilidad, incluso por API, archivos y exportaciones (§4, §9).

## Secuencia propuesta después de la revisión

TOCH confirmó el 2 de noviembre de 2026 que dar de alta clientes, configurar dominios y administrar usuarios y roles son facultades exclusivas del Administrador TOCH. El Gerente gestiona proyectos, presupuestos en horas y tareas de clientes asignados; el Administrador de Contrato cliente consulta su empresa y envía solicitudes. D-12 queda parcialmente resuelta; otras acciones siguen pendientes.

También está confirmada la combinación Gerente de Cuenta TOCH + Colaborador TOCH: la persona gestiona clientes asignados e imputa sus propias horas en proyectos autorizados. TOCH confirmó el 2 de noviembre de 2026 que el Gerente puede aprobar sus propias horas en proyectos de sus clientes asignados, manteniendo trazabilidad. En proyectos que requieren aprobación, la autorización para aprobar horas propias no elimina ese paso.

1. Resolver las decisiones que bloquean roles, acceso y esquema inicial.
2. Revisar modelo y matriz con el responsable TOCH y registrar su aprobación.
3. Autorizar una etapa acotada de identidad y base de datos de pruebas, sin datos reales.
4. Diseñar migraciones, controles de servidor y RLS con pruebas de aislamiento por cliente y rol.
5. Implementar módulos en entregas revisables según §13 y §17.4.

Antes de producción: revisión humana de RLS y funciones privilegiadas, pruebas de restauración y validación de permisos, horas y reportes (§17.3).
