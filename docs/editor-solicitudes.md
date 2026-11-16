# Editor y adjuntos de solicitudes

Corrección solicitada por TOCH el 03/11/2026 después de probar el acceso por dominio: selección de fuente y color, pegado de imágenes y adjuntos. La especificación 1.9 confirma texto enriquecido, capturas y adjuntos Office en Supabase privado. Esta entrega aplica esas capacidades al formulario de solicitudes; no implementa todavía la ficha de tarea ni comentarios.

## Capacidades

- Fuentes Arial, Georgia, Verdana y Courier New; color sobre texto seleccionado.
- Negrita, cursiva, subrayado, tachado, títulos, listas, citas, código, separador, enlaces HTTP/HTTPS y deshacer/rehacer.
- Capturas con Ctrl+V, imágenes y archivos seleccionados o arrastrados. Las imágenes cargadas se insertan dentro del detalle y también aparecen en la lista de adjuntos.
- Quitar un adjunto antes del envío elimina sus imágenes del detalle y descarta el archivo privado del borrador. No se permite sobrescribir ni eliminar archivos de solicitudes enviadas.
- Límites técnicos iniciales: 10 archivos, 10 MiB por archivo y 20 MiB por solicitud; PNG, JPG/JPEG, WEBP, GIF, PDF, TXT, CSV, DOCX, XLSX, PPTX y ZIP. El editor acepta hasta 10.000 caracteres. No se procesan ni ejecutan documentos o archivos ZIP.

El formato se conserva como documento JSON validado, además del texto simple compatible con las solicitudes anteriores. No se almacena HTML arbitrario, fuentes remotas ni imágenes de sitios externos. Las referencias persistentes son identificadores de adjuntos; las URLs blob de previsualización no se guardan. La validación se repite en servidor y PostgreSQL, también para llamadas directas.

## Persistencia y permisos

Requiere aplicar 202611030004_request_rich_content.sql después de la 003. **Migración 004 aplicada mediante SQL Editor en Proyecto Teté.**

La migración agrega description_document sin alterar solicitudes existentes, tabla de adjuntos, funciones de reserva/envío/descarte y bucket privado request-attachments. La aplicación usa la sesión normal de Supabase y la clave publicable; no necesita claves privilegiadas.

Cada carga requiere una reserva para el cliente deducido del dominio, remitente verificado, tamaño y tipo permitidos. Las rutas usan UUID y no nombres de archivo aportados por el navegador. Storage aplica políticas RLS de carga, lectura y descarte de borradores; no hay política de sobrescritura. El envío verifica que los objetos existan con tamaño y tipo esperados y asocia documento y adjuntos en una transacción idempotente.

Durante el borrador solo su autor habilitado puede acceder a sus archivos. Después del envío, la lectura sigue el alcance de la solicitud: Administrador TOCH, Gerente del cliente y Administrador de Contrato de esa empresa. El solicitante no obtiene navegación de tickets. La ruta de descarga verifica sesión y RLS antes de crear un enlace de 60 segundos, sin caché. La vista en línea se limita a imágenes raster; otros archivos se descargan.

No se crea una categoría de adjuntos internos en esta entrega. D-03 sigue pendiente para la ficha de tareas y colaboración. Las cargas abandonadas al cerrar o recargar el formulario pueden permanecer privadas y sin vincular; la limpieza programada de borradores no está implementada. No se incluye escaneo antivirus; los controles de extensión, MIME y tamaño no certifican que un archivo sea inocuo.

## Verificación

- Suite local completa: 40 pruebas aprobadas; incluye migraciones con mocks del esquema Storage, separación entre clientes, carga incompleta/tamaño incorrecto, rechazo de contenido inseguro, descarte de borradores, envío atómico y archivos enviados inmutables.
- Revisión real del editor local: selección de Georgia y color, confirmado en el DOM, sin enviar una solicitud de prueba real.
- Las pruebas pasaron secuencialmente después de que la ejecución paralela de varias bases PGlite agotara la memoria del equipo. El script de pruebas usa concurrencia 1.
- Prueba real autorizada: la solicitud ficticia 2bc10184-f4a2-48d3-b6fe-c10ebf38b657 recibió confirmación. Se verificaron fuente Georgia, color #2847b3 y el adjunto tete-prueba-004.txt de 50 bytes en el bucket privado. El pegado de capturas y la descarga quedan pendientes de prueba real.

Referencias técnicas consultadas: [Tiptap con Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs), [fuentes](https://tiptap.dev/docs/editor/extensions/functionality/fontfamily), [RLS en Storage](https://supabase.com/docs/guides/storage/security/access-control) y [cargas estándar](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
