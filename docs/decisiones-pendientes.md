# Decisiones pendientes de Teté

Estado al 2 de noviembre de 2026: D-01 y D-10 resueltas por TOCH en el chat; las otras 14 decisiones siguen abiertas. Responsable de resolución: TOCH. Las opciones y propuestas técnicas no constituyen reglas aprobadas.

La especificación 1.9 confirma las once decisiones de §12. Este registro no las reabre: identifica diferencias entre secciones y detalles necesarios para construirlas. Fuente y documentos relacionados: [índice](README.md), [permisos](matriz-permisos.md), [modelo](modelo-datos.md).

## Decisiones que afectan la base de acceso y datos

| ID | Tema y evidencia | Pregunta para TOCH | Momento de resolución |
| --- | --- | --- | --- |
| D-01 | Resuelta el 02/11/2026 por el responsable TOCH en el chat: confirmó «sí» a la equivalencia Encargado de Cliente = Gerente de Cuenta TOCH dentro de sus clientes asignados. | Aplicar esa equivalencia a reapertura, aprobación y autorización de correcciones de §12. El Administrador de Contrato cliente sigue siendo un rol independiente, contrapartida del lado cliente, con lectura y envío de solicitudes según la tabla confirmada. | Cerrada. Documentos actualizados: matriz de permisos e índice; no crea nuevos perfiles ni extiende permisos al cliente. |
| D-10 | Resuelta el 02/11/2026 por el responsable TOCH en el chat: descartó acceso individual a tareas y confirmó el resto de la propuesta de visibilidad. | Colaborador: acceso por proyecto asignado a todas sus tareas, sin autorizaciones individuales por tarea. Administrador de Contrato cliente: consulta todas las solicitudes, proyectos, tickets y horas de su empresa, sin información monetaria. | Cerrada. Actualizados matriz, modelo e índice. |
| D-11 | Confirmaciones de TOCH en el chat el 02/11/2026: multirrol permitido; Administrador de Contrato cliente + Solicitante externo; Gerente de Cuenta TOCH + Colaborador TOCH. El Administrador de Contrato corresponde siempre a exactamente una empresa cliente. | El Administrador de Contrato consulta su única empresa y presenta solicitudes. El Gerente/Colaborador gestiona clientes asignados e imputa sus propias horas en proyectos autorizados. Puede aprobar sus propias horas en proyectos de sus clientes asignados, con trazabilidad, aun cuando requieren aprobación. No se amplía acceso monetario. | Parcialmente resuelta: ambas combinaciones, cliente único y aprobación de horas propias confirmados. Otras combinaciones de roles requieren definición antes de habilitarse. |
| D-12 | Parcialmente resuelta por TOCH en el chat el 02/11/2026: alta de clientes, configuración de dominios y administración de usuarios y roles exclusivas del Administrador TOCH. Gerente gestiona proyectos, presupuestos en horas y tareas de clientes asignados; Administrador de Contrato consulta su empresa y envía solicitudes. | Siguen pendientes permisos específicos de cancelación, cambio de proyecto, edición del catálogo de estados, PDF individual y consulta de informes emitidos por Gerente; ¿los seis estados son fijos en V1.0? | Permisos de alta y configuración básica confirmados. Resolver las demás acciones antes del módulo correspondiente. |
| D-09 | Bolsas y cuotas por contrato, con consumos desde proyectos (§12.5, §12.12). | ¿Cada proyecto se vincula a un contrato? ¿Puede cambiar de contrato o usar varios? ¿Cómo se asignan períodos y excepciones de cómputo? | Antes de contratos y consumo. |

TOCH confirmó que Administrador TOCH opera en todos los clientes y proyectos con su único rol global, sin asignaciones adicionales de cliente o proyecto.

Para D-12 debe conservarse la distinción entre consulta operativa compartida y permiso de descarga/exportación; el documento exige autorización para ambas, pero no enumera todos los perfiles exportadores.

## Decisiones de horas y presupuesto

| ID | Tema y evidencia | Pregunta para TOCH | Momento de resolución |
| --- | --- | --- | --- |
| D-02 | §7 informa esfuerzo total para proyectos internos; §12.4 define consumo presupuestario solo facturable. En proyectos internos el valor inicial es no facturable (§16). | ¿El presupuesto interno se compara con el esfuerzo total o también solo con horas facturables validadas? ¿Solo cambia el indicador mostrado? | Antes de presupuestos internos. |
| D-04 | Cierre detiene y registra tiempo devengado (§12.12); al detener temporizador el colaborador confirma clasificación (§16.1). | Si otra persona cierra la tarea, ¿cómo se guarda ese tiempo y cómo se confirma clasificación sin crear horas nuevas en una tarea cerrada? ¿Qué ocurre con sesiones pausadas y con cancelación? | Antes de temporizador y cierre. |
| D-05 | Segundos históricos y política única de redondeo pendiente (§6). | ¿Se computan segundos exactos o bloques? Si hay redondeo, ¿intervalo, dirección y agrupación por imputación/día/tarea/período? | Antes de consumo; conservar siempre segundos reales. |
| D-06 | Sesiones cruzan medianoche y cortes persisten zona horaria (§6, RF-RM-05). | ¿Zona única corporativa o por usuario? ¿Cuál es la zona inicial y cómo se concilian fecha de trabajo y corte del cliente? | Antes de horas y reportes. |
| D-07 | Cuotas y bolsas con acumulación/vencimiento configurables (§12.5, §12.12). | ¿Qué periodicidades, vencimientos, arrastres y tratamiento de saldo negativo se habilitan inicialmente? | Antes de contratos. |
| D-13 | §12.2 autoriza corrección de clasificación; §12.12 contempla cambios de duración/anulación sin detallar toda la autorización. | ¿Quién ejecuta correcciones autorizadas? ¿Quién modifica fecha/duración o anula? ¿Qué ocurre en tarea cerrada o período emitido? ¿Cambiar `requires_time_approval` afecta horas anteriores? | Antes de edición y revisión de horas. |

Las alertas de presupuesto al 80% y 100% no bloquean trabajo válido en tareas abiertas (§7.2). Esta regla ya está confirmada; D-07 no habilita por sí misma un bloqueo por saldo.

## Colaboración, reportes y operación

| ID | Tema y evidencia | Pregunta para TOCH | Momento de resolución |
| --- | --- | --- | --- |
| D-03 | §9.1 menciona archivos internos o visibles al cliente; §12.11 y §14 establecen ficha e historial únicos compartidos. | ¿Todos los adjuntos de una tarea siguen la visibilidad compartida de la ficha, o se admiten adjuntos internos con reglas explícitas? | Antes de Storage y colaboración. |
| D-08 | Número inicial productivo después de auditar históricos (§15.1). | ¿Cuál es el inventario de IDs y el punto inicial aprobado? | Antes de migración productiva; pruebas con datos ficticios independientes. |
| D-14 | Estado al corte y snapshot de horas, con correcciones y rectificaciones (§8 bis, §16.3). | Al emitir un reporte con corte pasado, ¿se usa información conocida entonces o correcciones actuales sobre trabajo anterior? ¿Cómo se incluyen cargas tardías y tareas sin horas? | Antes de reportería. |
| D-15 | Enlace estable aunque cambie proyecto (§19); reportes por cliente y proyecto al corte (§8 bis). | ¿Se permite mover tareas entre clientes o solo entre proyectos del mismo cliente? ¿Cómo se atribuyen horas, consumos e historial de acceso tras moverlas? | Antes de habilitar movimientos de tarea. |
| D-16 | Historial preservado y corrección de secretos accidentales (§14.2); no hay política completa de retención/borrado. | ¿Quién puede retirar contenido sensible y cómo se corrigen PDFs/snapshots afectados sin destruir auditoría ni conservar secretos expuestos? ¿Qué retención aplica? | Antes de colaboración con datos reales y producción. |

## Normalizaciones técnicas propuestas

Estas propuestas no alteran reglas funcionales. Deben revisarse junto con el modelo antes de implementar.

| Referencia | Diferencia encontrada | Propuesta |
| --- | --- | --- |
| §3 | `task_status_history` y `task_status_events` describen historial equivalente. | Un solo registro de eventos de estado con estado inicial y datos suficientes para reconstruir el corte. |
| RF-RM-06, §15, §19 enlaces | Ejemplos `/tareas/TAR-7783`, `/tickets/7783` y `/tareas/7717`. | Ruta canónica configurable `/tareas/{ticket_number}` con entero global según requisito posterior. No habilitar enlaces públicos. |
| Dos secciones 19 | Enlace permanente y denominación comparten número de sección. | Referenciarlas por título hasta una nueva revisión documental. |
| §3, §12.10 | Tabla de entregas sugerida frente a envío manual confirmado. | Guardar artefactos y versiones; sin entregas automáticas ni registros supuestos de envío. |
| §3, §18 | El listado inicial no detalla vencimiento, dependencias ni revisiones enriquecidas. | Incluirlos en el modelo conforme a los requisitos posteriores. |

## Cómo registrar una resolución

Por cada ID, conservar fecha, responsable, respuesta explícita, referencia de aprobación y documentos afectados. Hasta entonces el estado sigue abierto. Actualizar la especificación fuente con el responsable TOCH cuando cambie o precise reglas; estos documentos derivados no la sustituyen.

Para la base segura están confirmados D-01, D-10, las combinaciones de roles documentadas en D-11 y los permisos de alta y configuración básica de D-12. No habilitar otras combinaciones de roles ni acciones pendientes sin definición. Las demás decisiones se resuelven antes del módulo afectado, sin impedir el trabajo independiente autorizado.

## Aclaración de acceso externo — 02/11/2026

TOCH confirmó que cualquier persona con correo verificado de un dominio autorizado puede acceder al flujo de Solicitante externo del cliente asociado, sin habilitación individual previa. Esta regla está resuelta y se documenta en la matriz y el modelo; la implementación del flujo externo sigue pendiente. No amplía permisos de gestión ni económicos. Los dominios se configuran exclusivamente por Administrador TOCH.

## Gestión de tareas — confirmada el 03/11/2026

El Administrador TOCH y el Gerente de Cuenta TOCH (en sus clientes asignados)
pueden asignar responsables entre los colaboradores TOCH activos habilitados para
el proyecto. Esos dos perfiles y el responsable vigente pueden cambiar el estado
operativo. El cierre manual es exclusivo del Administrador de Contrato de la empresa cliente. El responsable no adquiere permiso de reapertura. El historial de estados
es visible para quienes ya pueden consultar la tarea. El cierre automático por
inactividad queda para una etapa futura. La cancelación sigue pendiente de definición.
Esta decisión actualiza las reglas anteriores sobre asignación y cierre de D-12 y D-01.

## Flujo de solicitudes y estados de tareas

Una solicitud puede generar una o más tareas. El Gerente de Cuenta TOCH asignado
al cliente crea las tareas vinculadas y, al terminar, marca la solicitud como
**Procesada** para retirarla de la bandeja de pendientes.

| Estado de la tarea | Significado |
| --- | --- |
| Pendiente | Sin asignar. |
| Desarrollo | Alguien tomó la tarea. |
| Test | En manos del cliente para probar. |
| Consulta Cliente | En manos del cliente para responder una consulta. |
| Cerrada | Trabajo cerrado por el Administrador de Contrato del cliente. |

Un colaborador habilitado para el proyecto puede tomar una tarea pendiente.
Asignar o tomar una tarea pendiente la mueve a **Desarrollo**. El responsable,
el Gerente de Cuenta TOCH y el Administrador TOCH, dentro de su alcance, pueden
pasarla a **Test** o **Consulta Cliente** y devolverla a **Desarrollo**. Las
respuestas del cliente no cambian el estado automáticamente. El Administrador
de Contrato puede cerrar desde cualquier estado abierto de su empresa.

La migración 011 implementa el catálogo y las transiciones. **Procesada**
corresponde a la solicitud y se implementará junto con la creación de varias
tareas por solicitud.

## Planilla semanal y temporizador (§6)

Decisiones confirmadas por TOCH el 04/11/2026.

- La zona horaria es configurable por usuario y parte de Buenos Aires.
- Si se cierra una tarea con una sesión en marcha o pausada, Teté conserva los
  segundos trabajados. El Gerente de Cuenta del cliente o el Administrador TOCH
  confirma después la clasificación facturable. La clasificación se aplica al
  tiempo ya devengado.
- El Gerente de Cuenta o el Administrador designa una tarea existente del
  proyecto como genérica.

La base de carga manual conserva cada imputación en segundos con fecha,
detalle y clasificación. El redondeo para consumo se resolverá antes de
implementar ese cálculo (D-05).
