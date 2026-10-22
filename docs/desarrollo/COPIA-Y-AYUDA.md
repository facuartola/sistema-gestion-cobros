# Tanda 6: copia de seguridad, ayuda y mantener activo

Estado: **las tres partes están hechas y commiteadas** (sin push ni deploy).

## Parte A: copia de seguridad

- **Dónde**: Configuración › «Copia de seguridad» › «Descargar copia de todos los
  datos». Además, una tarjeta discreta en Inicio avisa «Hace N días que no
  descargás una copia» (o «Todavía no descargaste una copia») pasados 30 días. La
  fecha de la última copia se guarda **solo en el navegador** (`localStorage`,
  clave `ultima_copia`, con try/catch); la tarjeta lo aclara.
- **Ruta**: `GET /api/copia?sep=;` (solo lectura, 401 sin sesión). Código en
  `lib/copia.js` y `app/api/copia/route.js`; el botón, en `lib/useCopia.js` y
  `components/CopiaSeguridad.js` (con el candado `useCandado`: triple clic = una
  descarga).
- **Qué trae el .zip**: una planilla `.csv` por cada una de las 13 tablas de
  negocio (encabezados en castellano, relaciones con nombre además del id, tipos de
  gasto con su ruta completa, mismo criterio de separador que el resto de la app),
  `datos.json` (`{ version, generado_en, orden_restauracion, tablas }`, valores tal
  cual están en la base), `comprobantes.csv` y `LEEME.txt` (hora de Argentina,
  filas por tabla, aclaraciones). **No** trae administradores, mails permitidos,
  errores ni datos de acceso, ni los archivos de los comprobantes.
- **Garantías**: cada tabla se trae de a 1000 con orden por `id` y se compara contra
  un conteo exacto (y que no haya ids repetidos). Si algo no coincide: «No se pudo
  completar la copia: faltaron datos de X» y no se entrega nada. Si todas las
  tablas vienen vacías: error de posible problema de permisos (no se entrega un
  zip vacío). Si el zip pasa de 5 MB, la pantalla avisa (Netlify corta cerca de 6).
- **Restaurar**: `docs/RESTAURAR.md` y `scripts/restaurar-sql.js`
  (`node scripts/restaurar-sql.js datos.json restaurar.sql`). Ejemplo con datos
  inventados en `docs/ejemplo-copia/`.
- **/demo**: el botón baja una copia de los datos de ejemplo, armada en el
  navegador, sin pedidos a la API. (La demo no maneja cuotas por mes, clases,
  inscripciones ni sesiones: esas planillas salen vacías.)
- **Librería nueva**: `fflate` (zip, ~8 KB).

## Parte B: ayuda «¿Cómo hago…?»

- Ruta `/ayuda` (`components/AyudaPagina.js`, textos en `lib/ayuda.js`): 12 tareas
  desplegables con 3 o 4 pasos y un botón «Ir ahí», buscador por palabra, botón
  «Imprimir» (al imprimir se abren todas y se ocultan los botones). Se llega desde
  el botón «?» de la barra superior (escritorio) o desde el menú del usuario
  («Ayuda: ¿cómo hago…?», único camino en el celular). Incluida en /demo.
- Los nombres de botones y pantallas entre «» se compararon con la app (demo y app
  real). Tests: cada «Ir ahí» apunta a una pantalla que existe (`lib/ayuda.test.js`).

## Parte C: mantener activo el proyecto gratuito

Ver `docs/MANTENER-ACTIVO.md`. `GET /api/salud` (pública, `{ok}` solamente, caché de
5 minutos) y la función programada diaria `netlify/functions/mantener-activo.mjs`.
`lib/rutasApi.test.js` documenta y verifica que `salud` es la única ruta sin sesión.

## Qué no se pudo comprobar

- El `.sql` generado **no se ejecutó contra un Postgres** (no hay uno local ni se
  usó una base de pruebas). Se revisó a mano y con tests; conviene una restauración
  de práctica.
- La función programada **no se vio correr en Netlify** (el deploy lo hacés vos); sí
  se invocó a mano y devuelve lo esperado. El horario lo decide Netlify (`@daily`).
- La base real hoy tiene pocas filas (4 jugadores, 1 alumno, 14 tipos de gasto, sin
  certificación ni pagos): la paginación de más de 1000 filas se probó solo
  simulada, y los comprobantes y la certificación no se vieron en una copia real.
- La pantalla de entrada («Olvidé mi contraseña») se leyó en el código; no se
  recorrió con una sesión cerrada.
