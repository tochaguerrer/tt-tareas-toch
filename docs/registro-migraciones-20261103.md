# Aplicación de migraciones 002 y 003 — 03/11/2026

Autorización explícita de TOCH en el chat: «aplicar las migraciones 002 y 003 en Proyecto Teté de Supabase».

Proyecto de desarrollo: `ztclphzgljttkstftacn`, «Proyecto Teté», organización Toch Latin America. Aplicación manual con SQL Editor, primero 002 y luego 003, respetando las transacciones de los archivos. Ambos resultados fueron `Success. No rows returned`. No se repitieron la migración 001 ni el bootstrap.

| Archivo aplicado | SHA256 |
| --- | --- |
| `202611020002_user_administration.sql` | `4A69E87981A425234842FCFE6FFA4999ADD3D852A24823D6EAAB2B2804A23EF7` |
| `202611020003_external_requests.sql` | `1ABD56896633DB0983A3A828625782500C3EC67BCBE5B40CCFA9EB9BFC6B7D0B` |

El contenido de cada archivo se comparó íntegramente con el texto seleccionado en el editor antes de ejecutarlo, normalizando únicamente los saltos de línea.

## Verificación previa

`clients`, `client_domains` y `admin_save_account` no existían; no había asignaciones con `client_id` o `project_id`. Por lo tanto no fue necesario crear referencias ficticias ni cambiar permisos de personas para aplicar las claves foráneas.

## Verificación posterior de solo lectura

Consulta de catálogos y privilegios ejecutada en el proyecto remoto:

- Las cuatro tablas `clients`, `projects`, `client_domains`, `incoming_requests` existen con RLS habilitado.
- Existen las cinco RPC nuevas: `admin_save_account`, `admin_transfer_administration`, `admin_create_client`, `admin_save_domain`, `submit_external_request`.
- `authenticated` no puede ejecutar `admin_set_account_legacy`.
- `anon` no puede ejecutar `submit_external_request`; `authenticated` sí, sujeto a la identidad y al dominio verificados dentro de la función.
- `anon` y `authenticated` carecen de permisos INSERT, UPDATE y DELETE directos sobre las cuatro tablas nuevas.
- La definición remota de `admin_save_account` contiene la protección del último Administrador activo.
- Conteos posteriores: 0 clientes, 0 dominios, 0 solicitudes.

La sesión real de Administrador TOCH abrió `/inicio/dominios` y recibió los formularios, sin el aviso de configuración pendiente. No se crearon clientes, dominios, solicitudes ni usuarios reales, ni se desactivaron o transfirieron cuentas como prueba.

## Límites y próximos pasos

Las 32 pruebas locales, lint, TypeScript y build pasaron en la entrega de código anterior; los archivos SQL conservan los hashes aprobados. En esta aplicación se realizaron verificaciones remotas de catálogos, permisos y navegación; no se repitieron pruebas que requirieran cambios de personas reales.

Falta cargar el cliente y dominio autorizados y probar con otra cuenta Google verificada. El modo de pruebas del cliente OAuth puede restringir qué cuentas admite Google. No se hicieron despliegues, push ni merge.

SQL Editor no registra estas aplicaciones en el historial de Supabase CLI. Antes de usar `db push`, reconciliar las migraciones 001, 002 y 003 con el historial remoto; no ejecutarlas nuevamente para intentar registrarlas.
