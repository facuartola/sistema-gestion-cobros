# Historial de pasadas

## Tanda final: arreglos y gastos personalizables (2026-10-06)
Detalle y puntos de corte en [`docs/TANDA-FINAL.md`](./docs/TANDA-FINAL.md); máximos de clics en [`docs/CRITERIOS-DE-USO.md`](./docs/CRITERIOS-DE-USO.md).
- **A1. Falla "e is not iterable" en Inicio** (fila de `errores_app` del 5/10, 23:45 hora Argentina): se esparcía `resumen.proximos` (`agendaProxima`) cuando no venía como lista. Ahora las respuestas de `/api/resumen` y `/api/panorama` se normalizan al llegar (`lib/inicioDatos.js`: listas vacías y ceros por defecto), las funciones de `lib/resumen.js`, `lib/panorama.js`, `lib/paraHacer.js` y `lib/gastos.js` toleran entradas ausentes, los cálculos tienen respaldo (`calcularInicio`) y **cada bloque tiene su propio límite de error** con mensaje amable y «Reintentar» (`components/inicio/BloqueSeguro.js`): un bloque que falla ya no tumba la pantalla. 22 tests nuevos.
- **A2. Relojes**: Argentina, Miami, Paraguay y México en una línea desde 1270 px de ancho de ventana (así entra con los 1280 reales); por debajo, reloj compacto de Argentina con los otros tres al tocarlo; en el celular, los cuatro en el menú del usuario. Zonas horarias reales (`Intl`).
- **A3. Gastos sin monto**: la frase del Inicio dice «…y N gastos sin monto cargado» con el enlace «Cargar los montos»; la proyección también lo aclara. Al registrar un pago de un tipo sin monto habitual se ofrece guardarlo como monto habitual (tildado de entrada en los que se repiten).
- **A4. Imprimir en Certificación**: «Imprimir» en el menú «⋯» del resumen de módulos, el avance de alumnos y el equipo; sin barra ni botones, en blanco y negro.
- **B1 a B8. Mis gastos** (reemplaza a «Editar tipos de gasto»; `/gastos/categorias` sigue respondiendo): agregar (3 clics), renombrar, **mover a otra carpeta** (nuevo en la validación, la API y /demo), subir y bajar, desactivar y reactivar (con «Mostrar desactivados»; al reactivar una carpeta vuelve lo que tenía adentro), borrar con confirmación en la fila. Solo cinco preguntas: Nombre, Dentro de, ¿Se repite?, Monto habitual y día de vencimiento. Un test prueba que **«¿Se repite?» decide y la carpeta solo ordena**. «+ Crear un tipo nuevo» al final del selector de «Registrar pago» (candado de doble clic). Los tipos con clave se muestran como «Automático: lo genera Pagar al equipo»: se renombran, no se mueven, desactivan ni borran, y la pantalla lo explica. «Gastos por tipo» agrupa por la carpeta que contiene el tipo (regla documentada en `lib/panorama.js`, probada con 3 árboles) y distingue dos carpetas con el mismo nombre. Ayuda: «Agregar un gasto nuevo» (12 tareas).
- **B7. Base**: las cinco migraciones de octubre que faltaban en el repo (vistas del panorama, pagos atrasados, límites de datos, ping y `proteger_tipos_de_gasto`) se trajeron de la base real. `scripts/restaurar-sql.js` apaga también los automatismos de `categorias_gasto` durante la carga (el trigger `proteger_categorias` impide borrar los tipos con clave y la restauración los borra); test nuevo y prueba de restauración repetida en PGlite con las 17 migraciones.
- **C1. Inicio en dos vistas**: «Hoy» (por defecto: frase, tres botones, Para hacer, Quién debe y Por cobrar, Cobrado del mes y Resultado) y «Análisis» (todo lo demás). La elegida se recuerda en el navegador; /demo muestra las dos.
- **C2. Valores extremos en el gráfico**: un valor mayor a 4 veces la mediana del resto se dibuja con la barra cortada, con una marca visible, y su valor real en el tooltip y en «Ver como tabla».
- Mensajes de la base para los tipos de gasto (P0001, en castellano) llegan tal cual a la pantalla, y la pantalla los previene antes de enviar (mover adentro de sí mismo, pasar de 3 niveles, nombre repetido…).

## Verificación final antes de publicar (2026-10-05)
Informe completo y checklist en [`docs/VERIFICACION-FINAL.md`](./docs/VERIFICACION-FINAL.md).
- **"Para hacer" se puede ocultar y mostrar** (pedido de la clienta que faltaba): queda una tarjeta finita con el contador y "Mostrar"; la elección se recuerda en el navegador (no en /demo).
- **La API rechaza fechas de pago futuras o anteriores a 2020 y cuotas de más de un año adelante** (antes aceptaba un cobro de 2031, que inflaba "cobrado").
- **Accesibilidad**: al abrir el panel lateral el foco entra al panel (antes seguía en la página de atrás) y vuelve a quien lo abrió al cerrar; los buscadores tienen nombre accesible.
- La variación de las tarjetas del Inicio se acota a "más de 999 %" (un cliente de monto extremo daba "▲ 49956 %").
- El `LEEME.txt` de la copia usa los nombres de siempre (Tipos de gasto, Pagos de gastos…) en vez de los nombres internos de las tablas.
- `scripts/verificar-restauracion.mjs`: prueba la restauración con una base Postgres en memoria (PGlite) y las 12 migraciones reales; `docs/RESTAURAR.md` explica cómo recrear usuarios y administradores.

## Ajuste visual: barras de desplazamiento (2026-10-05)
Lista completa de cada barra y su decisión en [`docs/BARRAS-DE-DESPLAZAMIENTO.md`](./docs/BARRAS-DE-DESPLAZAMIENTO.md); capturas en `docs/capturas/barras-*`.
- **Menú lateral sin barras**: la causa era el menú del usuario, que cerrado quedaba debajo del bloque del usuario (una regla pisaba a otra). Ahora mide `100dvh`, las secciones se desplazan por dentro sin barra visible y el bloque del usuario queda fijo y entero; nombre y mail con puntos suspensivos.
- **"Para hacer"** se desplaza sin barra visible (rueda, touch y teclado), con un degradé al pie mientras hay más y accesible (`role="region"`, `aria-label`, `tabindex="0"`, foco visible). Componente `components/ZonaDesplazable.js`.
- **Barras finas** con los colores del tema en la página y en las zonas que necesitan desplazarse (panel del cliente, Ctrl+K, ventanas en celular).

## Tanda 6: copia de seguridad, ayuda y mantener activo (2026-10-05)
Detalle en [`docs/COPIA-Y-AYUDA.md`](./docs/COPIA-Y-AYUDA.md).
- **Copia de seguridad**: Configuración › "Copia de seguridad" baja un .zip con una planilla por tabla, `datos.json` (copia fiel), `comprobantes.csv` y `LEEME.txt`. `GET /api/copia` (solo lectura, 401 sin sesión) trae todo de a 1000, compara cada tabla contra un conteo exacto y, si algo falta, falla sin entregar un archivo parcial. Tarjeta en Inicio si pasaron más de 30 días (fecha guardada solo en el navegador). Funciona en /demo sin pedidos a la API. Librería nueva: `fflate`.
- **Restaurar**: `scripts/restaurar-sql.js` convierte `datos.json` en un .sql (transacción, orden de dependencias, automatismos apagados durante la carga, tipos de gasto de ejemplo vaciados antes). `docs/RESTAURAR.md` y ejemplo en `docs/ejemplo-copia/`.
- **Ayuda "¿Cómo hago…?"** en `/ayuda`: 11 tareas con pasos y "Ir ahí", buscador, imprimible, botón "?" en la barra superior y entrada en el menú del usuario; también en /demo.
- **Mantener activo Supabase**: `GET /api/salud` pública (solo `{ok}`, caché de 5 minutos, llama a `public.ping()`), función programada diaria `netlify/functions/mantener-activo.mjs` y `docs/MANTENER-ACTIVO.md`. Es la única ruta de la API sin sesión; `lib/rutasApi.test.js` lo verifica.

## Tanda 4, sesión 3 (2026-10-05)
- **Certificación en una sola página** (`/certificacion`): tira de los 10 módulos con su estado (pagado, listo para pagar, en curso, sin empezar) y pestañas Módulos | Alumnos | Equipo (la elegida se recuerda). Las direcciones viejas (`/modulos`, `/alumnos`, `/equipo` y sus fichas) siguen respondiendo y caen en su pestaña.
- **Módulos**: aviso "El Módulo N terminó: hay que pagar US$ X a P personas" con **Pagar al equipo**, y aviso "Pagos atrasados al equipo" con **Pagar lo atrasado**. **Alumnos** y **Equipo** con panel lateral (ficha con las 10 sesiones, cambio de coach, rol, cobrado y deuda, desactivar y borrar). La planilla del módulo se abre bajo la tira.
- **"Registré una clase o sesión"** (Inicio y "+ Nuevo") lleva al módulo en curso con su planilla.
- **Recordatorios más simples**: arriba el campo para agregar (título, día y, si se quiere, una persona); grupos Hoy (con lo vencido), Esta semana y Más adelante; Hechos plegado; tildar uno lo marca hecho con Deshacer; las sugerencias van en una sección plegada.
- **Revisión de textos**: ya no se ven liquidar, liquidación, pendientes, período, categoría ni recurrencia ("categoría" pasó a "tipo de gasto", "período" a "mes"/"tramo"). Un test (`lib/vocabulario.test.js`) revisa los textos del código para que no vuelvan.
- **Celular**: barra de navegación inferior fija con las 5 entradas (y contador en Recordatorios) en lugar del cajón; el menú del usuario (Configuración y Cerrar sesión) pasa a un botón de la barra superior. Paneles y ventanas suben como hojas desde abajo, con botones de al menos 44 px y sin scroll horizontal; con una hoja abierta la barra se esconde para no tapar los botones de guardar.
- **Inicio: la variación compara el mismo tramo.** Cobrado, Gastado y Resultado se comparan del 1 al día de hoy contra del 1 al mismo día del mes anterior (y lo dicen: "vs. el mismo tramo del mes anterior"); sin movimientos en ese tramo, un mensaje neutro en vez de un porcentaje. `GET /api/panorama` suma `diarios` (solo lectura). Tests y `docs/INICIO.md` al día.
- **CSV en Excel**: con coma decimal en el navegador (es-AR y similares) el separador es punto y coma y los números llevan coma decimal; con punto decimal, coma. Se mantienen el BOM UTF-8, las comillas duplicadas y los saltos de línea entre comillas. Los menús dicen "Exportar a Excel – Se abre en Excel con columnas".
- **Documentación**: `docs/SIMPLIFICACION.md` completo (qué se movió, qué se ocultó, qué se unificó, lista de textos cambiados y diferencias) y `docs/MAPA-FUNCIONES.md` con cada función de antes y dónde está ahora.
- **Arreglos de las pruebas en vivo**: un cliente nuevo cargado en Cobros aparece enseguida en "Inscribir alumno"; la ficha de una persona del equipo trae el módulo de cada clase y sesión; el CSV usa `;` también en un Chrome `es-US` con zona horaria de Argentina.
- **Mensajes de la base traducidos en la API** (`lib/mensajesApi.js`, con tests): "ya fue liquidado" pasa a "ya fue pagado" y "antes de liquidar" a "antes de pagar al equipo".
- `GET /api/equipo?resumen=1` (solo lectura) suma lo cobrado y el rol por persona; `GET /api/certificaciones/[id]` suma `listos` y `tardios`.
- **Primer clic que no respondía**: reproducido en la versión compilada (con /demo, 2 de 5 cargas perdían un clic dado apenas aparecía el menú). Ahora un clic antes de que la página esté lista se guarda y se repite al terminar de cargar (`components/PaginaLista.js`); el cursor avisa mientras tanto. 0 fallos en 18 pruebas.

## Tanda 5: panel de Inicio (2026-10-05)
Detalle de cada bloque y de dónde sale cada número en
[`docs/INICIO.md`](./docs/INICIO.md).
- **Inicio profesional**, siempre visible (reemplaza "Ver resumen del mes"):
  indicadores (resultado, cobrado, gastado, por cobrar, tasa de cobranza) con
  mini línea y variación contra el mes anterior; gráfico de ingresos y gastos
  con el resultado neto; anillos de cobros del mes y gastos por tipo; cobros por
  método; certificación; "Quién debe"; próximos 30 días; proyección del mes y
  últimos movimientos. "Para hacer" queda siempre a la vista.
- **Selector de período** (Este mes, Últimos 6 meses, Este año), recordado, que
  gobierna los gráficos sin volver a pedir datos.
- **`GET /api/panorama`** (solo lectura, 401 sin sesión): lee las vistas
  `cobros_mensuales` y `gastos_mensuales_por_tipo` y los pagos del año. Cobrado y
  gastado cuentan por fecha de pago y los clientes dados de baja cuentan.
- **Gráficos** en SVG propio, con resumen en texto, "Ver como tabla", teclado,
  tooltips de vidrio, entrada de 600 ms una sola vez y estados vacíos; contraste
  medido en tests (el hueso de las barras de gastos subió de 0,34 a 0,5).
- **/demo** con 12 meses de historia, atrasados, deudores, gastos repartidos y
  la certificación de ejemplo, todo en memoria.
- **Código**: `lib/panorama.js` (+ 31 tests: mes anterior sin datos, división por
  cero, cambio de año, un solo cobro), `lib/panoramaDemo.js`,
  `components/panel/`. Pie de Cobros aclarado ("por mes de la cuota").

## Tanda 4, sesión 2: Fase 2B, Gastos "¿Qué pagaste?" (2026-10-05)
- **`/gastos` con tarjetas**: el árbol de tipos de gasto se dibuja desde la base
  (hasta 3 niveles, solo activos) como grupos con tarjetas. Cada tarjeta dice su
  estado y tiene un botón: mensual "Vence el 10 · US$ 45" con **Pagué** (o "Al
  día este mes"), anual "Se renueva en julio" (o "Al día"), y sin repetición
  "Último pago: fecha y monto" / "Sin pagos todavía" con **Registrar pago**.
- **Orden**: primero lo vencido, después lo que vence, después el resto, dentro
  de cada grupo y entre grupos. Los grupos se pliegan; hay buscador ("Buscar un
  gasto").
- **Pagué** registra el pago en un paso (monto del tipo, último método, hoy) con
  Deshacer; la primera vez, sin método recordado, abre la ventana. **Registrar
  pago** abre la ventana con el tipo ya elegido (con comprobante).
- **Equipo de coaches**: una sola tarjeta "Pagos al equipo" (detectada por la
  columna `clave`) con botón a Certificación y "Ver historial".
- **Punto de vencimiento** en la tarjeta y en el Inicio; se sacó del menú.
- **Pie**: "Ver todos los pagos" y "Editar tipos de gasto". "Ver historial" de
  cada tarjeta y grupo abre las pantallas de historial de siempre.
- **Código**: `lib/gastosTarjetas.js` (puro, con tests), `components/GastosInicio.js`.

## Tanda 4, sesión 2: Fase 2A, Cobros (2026-10-05)
- **Una sola pantalla `/cobros`** con las pestañas Jugadores y Alumnos de la
  certificación (la elegida se recuerda en el navegador). `/jugadores` y
  `/alumnos` redirigen (`next.config.mjs`).
- **Filas de solo lectura**: nombre, monto, vencimiento, estado (Pagó, Atrasado,
  Vence el N, Sin vencimiento), barra de avance en alumnos y botón "Cobré", que
  abre la ventana de cobro de un solo paso (monto precargado, último método,
  fecha de hoy, Deshacer).
- **Panel lateral** (hoja inferior en el celular) con todo lo editable: nombre,
  contacto, notas, monto mensual, día de vencimiento, monto total, la cuota del
  mes (estado, monto, fecha, método), deuda acumulada, cobrado del año, últimas
  cuotas, recordatorio y "Dar de baja" con confirmación y Deshacer.
- **Menú ⋯** con Exportar CSV e Imprimir.
- **API**: `GET /api/jugadores|alumnos/[id]/cuotas` (solo lectura, últimas
  cuotas de una persona) para el panel. No se tocó la base.
- **Código**: `lib/cobros.js` (estado y frase de resumen), `lib/useCandado.js`
  (candado inmediato contra el doble clic, para todo lo nuevo que guarda) y
  `lib/clienteFormulario.js` (validación compartida con la ventana de alta).
  Se eliminó `PersonasPage.js`.

Registro cronológico de qué se hizo en cada sesión de trabajo y por qué. El
README.md se quedó solo con el estado actual, la arquitectura y las
decisiones vigentes; acá queda el detalle histórico de cómo se llegó.

## Primera pasada — armado inicial
- Proyecto Supabase creado: `sistema-gestion-cobros` (organización "Costos" en Supabase, plan free).
- Tablas creadas: `jugadores`, `cuotas_jugadores`, `alumnos`, `cuotas_alumnos`, con RLS activado (solo usuarios autenticados pueden leer/escribir).
- Backend: rutas API en `/app/api/...` (Next.js Route Handlers) para listar/crear jugadores y alumnos, y registrar cuotas mes a mes.
- Frontend: páginas `/jugadores` y `/alumnos` con la paleta navy/dorado del sitio de la clienta, resumen de cuotas (recaudado, al día, pendientes) y tabla con toggle de estado (click en el badge para marcar pagado/pendiente).

## Segunda pasada
- **Login**: agregado con Supabase Auth (email + contraseña). Toda la app queda bloqueada detrás de un login simple (`components/AuthGate.js`).
- **Selector de mes**: ahora se puede ver y cargar cuotas de los últimos 6 meses, no solo el actual (`components/MonthSelect.js`).
- **Paleta actualizada**: fondo blanco, sidebar navy, acentos en dorado y grises/negro.
- **Fix importante de seguridad/RLS**: las rutas API ahora reciben el token de sesión del usuario logueado (`lib/apiFetch.js` en el frontend + `lib/supabaseServer.js` en el backend) y lo usan para las consultas a Supabase. Antes las políticas RLS exigían usuario autenticado pero el backend consultaba como anónimo, lo que iba a bloquear todos los pedidos silenciosamente.
- **Verificado contra la base real**: probé inserts y el upsert de cuotas (evita duplicar si tocás el mismo mes dos veces) directamente contra las tablas de Supabase — funciona correctamente.

## Tercera pasada
- **Manejo de errores real en el frontend**: si el backend falla (por red, por sesión vencida, por dato inválido), ahora se muestra un aviso claro en la página en vez de romperse silenciosamente.
- **Botones con estado de carga**: "Agregando…" al crear una persona, y el badge de estado se deshabilita mientras se actualiza, para evitar dobles clicks.
- **Validación server-side reforzada**: nombre vacío/con espacios, estado que no sea "pagado"/"pendiente", y monto que no sea un número válido, todo se rechaza con un mensaje claro (antes solo se validaba que existieran los campos, no que tuvieran sentido).
- **Verifiqué la seguridad RLS con una prueba real** (no solo revisando el código): inserté un jugador directo en la base y confirmé que una consulta con la clave anónima (sin sesión) no lo puede ver.
- **.gitignore** agregado para no subir `node_modules` ni `.env.local` a un repo por error.

## Cuarta pasada — sistema de diseño (glass, tipografía, jerarquía)
Rediseño completo de la identidad visual, pensado para que no se sienta "genérico":
- **Vidrio de verdad**: fondo con degradé navy-carbón fijo detrás de toda la app, y los paneles (sidebar, tarjetas, tabla, login) usan `backdrop-filter: blur()` real sobre ese fondo — no un blanco con sombra disfrazado de "glass".
- **Tipografía con carácter**: serif (Fraunces) para el nombre de marca, los títulos de página y el número de "recaudado"; sans (Inter) para todo lo funcional — tablas, formularios, botones. Cargadas vía `next/font`, sin depender de internet en runtime.
- **Un solo momento protagonista**: en vez de tres tarjetas idénticas, el monto recaudado es un bloque más grande en serif, y "al día"/"pendientes" son chips más chicos al lado — jerarquía real.
- Saqué los "·" (punto medio) de los títulos, un tic típico de diseño generado por IA — ahora los títulos son frases naturales.

## Quinta pasada — los 3 críticos + responsive + export
- **Monto editable por fila**: ya no es un valor fijo; cada persona puede tener un monto distinto por mes, editable con un click.
- **Fecha de pago editable**: al marcar "pagado" se sigue autocompletando con la fecha de hoy, pero ahora se puede corregir manualmente si el pago fue otro día.
- **Editar nombre y dar de baja**: click en el nombre para renombrar; botón "Dar de baja" por fila (no borra el historial, solo lo saca de la lista).
- **Solo se listan personas activas** por defecto.
- **Exportar a CSV** desde cada página.
- **Responsive**: sidebar pasa a barra superior en pantallas angostas, la tabla scrollea horizontal, tarjetas de stats en vertical.
- **Foco de teclado visible** en todos los controles.
- **Verificado contra la base real**: ciclo completo (crear → editar nombre → cargar cuota con fecha manual → dar de baja → borrar), incluyendo que el borrado de una persona borra en cascada sus cuotas sin dejar huérfanos.
- Encontré y corregí un bug menor de comparación numérica (Postgres devuelve los montos como texto, lo que podía disparar guardados de más al tocar el campo sin cambiar nada).

## Sexta pasada — login completo, identidad del sitio y guía de deploy
- **"Olvidé mi contraseña"**: agregado en el login + una página `/reset-password` que procesa el link que llega por mail.
- **Favicon y metadata**: ícono con la marca (`app/icon.svg`) y título/descripción prolijos.
- **Fix de estructura**: la página de reset de contraseña ya no mostraba el sidebar de la app alrededor.

## Séptima pasada — primera corrida real en local
Primera vez que el proyecto corre en la máquina de desarrollo (hasta acá solo se había armado y probado por SQL desde otro entorno).

### Dependencias y seguridad
- `npm install` anduvo sin errores de resolución de versiones.
- **Next.js 14.2.5 → 14.2.35** (la última 14.2.x). La 14.2.5 estaba marcada como deprecada por vulnerabilidades.
- `npm audit` no quedó limpio (1 crítica + 1 alta) en ese momento: resolverlo implicaba saltar a Next 16 (mayor), fuera de alcance de esa pasada.

### Bugs corregidos (encontrados leyendo el código)
- **El GET de `/api/jugadores` y `/api/alumnos` ignoraba el error de la consulta de cuotas.** Si esa consulta fallaba, la respuesta seguía con todos como "pendiente": un dato silenciosamente incorrecto. Ahora devuelve `500 + { error }`.
- **Desfase de mes/fecha por UTC.** `toISOString()` convierte a UTC; Argentina es UTC-3, así que entre las 21:00 y las 23:59 locales la fecha UTC ya es la del día siguiente. Solución: `lib/fechas.js` arma el `YYYY-MM`/`YYYY-MM-DD` con `getFullYear/getMonth/getDate` (hora local); en el backend, `hoyArgentinaISO()` fija la zona explícitamente.
  - Verificado simulando el instante 30/09/2026 22:00 hora Argentina (= 01/10 01:00 UTC): el método viejo daba `2026-10`, el nuevo da `2026-09`/`2026-09-30`.
- **Inputs de monto y fecha con `defaultValue` + `onBlur`** no se resincronizaban al cambiar de mes. Se agregó una `key` que incluye persona + mes + valor guardado, forzando un remount con el valor real.

### Estado de la verificación
- Verificado: compila (`next build`), test del caso límite horario.
- **Verificado en navegador después:** desfase UTC (simulado, ver detalle arriba), inputs con `key` (guardado en septiembre, cambio a agosto mostró el valor correcto), error de cuotas propagado (solo por lectura de código en ese momento, no se forzó el fallo real).

## Octava pasada — monto y vencimiento por persona, seguimiento de abonado
Pedido del cliente: cada jugador y alumno tiene su propio monto mensual y día de vencimiento, y los alumnos pueden tener un costo total con seguimiento de lo abonado. Las columnas nuevas (`monto_mensual`, `dia_vencimiento`, `monto_total` solo en alumnos) las agregó una migración aplicada aparte en Supabase.

- **"Agregar cliente"**: modal único (`components/ClienteModal.js`) con nombre, tipo, monto mensual (precargado según tipo), monto total (solo alumnos) y día de pago.
- **Editar cliente**: lápiz ✎ junto al nombre abre el mismo modal precargado. El tipo queda fijo en edición.
- **Monto por persona**: se eliminaron las constantes de monto por defecto globales.
- **Progreso de alumnos con monto total**: columna "Abonado" con `$abonado / $total` y barra. Suma histórica, paginada de a 1000 filas.
- **Atrasos**: si hay `dia_vencimiento` y la cuota está pendiente, badge "Atrasado" cuando hoy es posterior al día de vencimiento. Los meses anteriores al actual también se marcan atrasados si siguen pendientes. Sin `dia_vencimiento`, se mantiene "Pendiente".
- **Validación server-side** (`lib/camposCliente.js`): monto mensual y total > 0, día entero 1-31.
- **Mobile**: ancho mínimo de tabla subido de 480 a 780px.

### Cómo se verificó
- Navegador real: alta de alumno con monto total y día; progreso sumando cuotas pagadas de 3 meses distintos; edición; alta de jugador con monto y día custom; validación de día 40; atraso pasando el día de vencimiento; aviso de éxito; modal y tabla en 390px (emulado).
- Lógica de atraso probada aparte con 9 casos límite.
- **No verificado en ese momento**: la migración de Supabase en sí (se tomó como aplicada); mobile real en un teléfono; que el CSV se abra en Excel; el final completo del reset de contraseña.

## Novena pasada — Recordatorios, contacto/notas, sesión vencida y tests
Migración aplicada aparte en Supabase: columna `notas` en `jugadores`/`alumnos`, tabla `recordatorios` y tabla `errores_app`.

### Recordatorios (pedido de máxima prioridad)
- Entrada "Recordatorios" en el sidebar con un contador (badge rojo) de los vencidos o de hoy sin marcar como hechos.
- Página `/recordatorios`: formulario rápido (título, fecha, tipo General/Cobro/Seguimiento, nota, buscador de persona), lista agrupada en Vencidos / Hoy / Próximos 7 días / Más adelante / Hechos, marcar hecho y deshacer, editar, eliminar con confirmación.
- **Sugeridos** (`lib/sugerencias.js`), calculados al vuelo, nunca guardados: cobros atrasados, cuotas que vencen en 3 días, alumnos por completar `monto_total` (≥80%), y una cuarta agregada por criterio propio — "antes de fin de mes" (alguien sin `dia_vencimiento` nunca se marca atrasado solo).
- Acceso rápido desde las tablas de Jugadores/Alumnos (vía query params, sin duplicar el formulario en un modal aparte).
- Botón "Recordar" (`lib/recordar.js`): WhatsApp Web o `mailto:` con mensaje prellenado.
- Campos "Contacto" y "Notas" en el modal de cliente.
- Backend: `app/api/recordatorios/*`, validación en `lib/recordatorios.js` (testeada).

### Sesiones vencidas
Antes, una request sin sesión devolvía `[]` con `200 OK` (RLS filtraba en silencio). Se agregó `lib/apiAuth.js` (`exigirSesion`) a todas las rutas, que corta con `401` y mensaje claro. El frontend detecta el 401, cierra sesión local y muestra un aviso amable en el login.

### Tests automatizados (Vitest)
Se agregó Vitest con 31 tests iniciales sobre fechas, validación de recordatorios y de campos de cliente.

### npm audit
1 aviso crítico y 1 alto, originados en el rango de versiones de `next`. La mayoría de los CVE agrupados son sobre Server Actions, `next/image`, `rewrites`/i18n y Windows — no aplican a la superficie real de esta app (sin Server Actions, sin `next/image`, sin rewrites/i18n, corre en Linux/Vercel).

### Cómo se verificó
- En navegador real, con datos "TEST" borrados de verdad al terminar: alta de recordatorio con y sin persona asociada (buscador probado), acceso rápido desde una fila atrasada, marcar hecho/deshacer, editar, eliminar, botón "Recordar" (link de WhatsApp correcto), badge del sidebar actualizándose, crear recordatorio desde sugerencia, y el flujo completo de sesión vencida (token corrompido a propósito).
- Bug encontrado y corregido en el momento: el buscador de persona no se limpiaba visualmente tras crear un recordatorio (se solucionó remontando `PersonaSelect` con una `key` que cambia tras cada alta, no sincronizando la prop en cada render).
- **Aviso importante**: para probar el 401 se forzó una sesión inválida, lo que disparó `supabase.auth.signOut()` — por defecto cierra sesión en todos lados, no solo en esa pestaña.
- `next build` y `npm test` limpios.
- **No verificado en navegador en esa pasada**: el flujo con un alumno asociado (mismo código que jugador), la sugerencia de "monto total" y la de "antes de fin de mes", y el link `mailto:`.

## Evaluación Next 16 (rama `next-16-evaluacion`)
Ver [`docs/INFORME-NEXT-16.md`](./docs/INFORME-NEXT-16.md): versiones, el
bug real encontrado (`params` sin `await` en las rutas API dinámicas, propio
de Next 15+), resultado de tests/build/audit, y la causa investigada del
aviso "JWT issued at future" (del lado del servidor de Supabase, no de la
migración). Recomienda migrar recién después del deploy inicial en 14.2.x.

## Décima pasada — reloj mundial, panel de recordatorios y modo demo
Tres pedidos independientes, cada uno en su propio commit chico.

### Reloj mundial
`lib/horasMundiales.js` arma la hora de Miami, Argentina, Paraguay y Ciudad
de México con `Intl.DateTimeFormat` + `timeZone` (nunca offsets fijos), así
el horario de verano de Miami se resuelve solo. `components/WorldClock.js`
la muestra en una barra fija arriba de todo el shell (no en el login),
actualizada cada minuto — el formato es HH:mm sin segundos, así que
refrescar cada segundo sería 60x el trabajo sin cambio visible la mayoría de
las veces. Renderiza `null` hasta montar en cliente para evitar el error de
hidratación de Next, y limpia el intervalo al desmontar. En mobile pasa a
grilla 2x2. Tests con fecha fija cubriendo Miami en DST y sin DST, y un caso
con día distinto al de Argentina (Paraguay resultó ser UTC-3 fijo, igual que
Argentina, no UTC-4 como se asumió al principio — se verificó con
`Intl.DateTimeFormat` directo antes de fijar los valores del test).

### Panel de recordatorios
El shell pasa a tres columnas: nav (sin la entrada "Recordatorios", que se
mudó al panel) — contenido — panel (`components/RecordatoriosPanel.js`).
Compacto: contador de vencidos/hoy, bloques Vencidos/Hoy/Próximos 7 días,
Sugeridos, alta rápida (título/fecha/tipo) y marcar hecho con deshacer
(reusa `Toast`). Se puede plegar (recordado en `localStorage` con
try/catch); en mobile es un cajón con foco atrapado (`useFocusTrap`
existente) y cierre con Escape, abierto con un botón flotante con contador.

Estado único en `lib/RecordatoriosContext.js`: tanto el panel como
`/recordatorios` (refactorizada para consumirlo) leen y mutan la misma
lista, así que un cambio desde cualquiera de los dos se refleja en el otro
sin recargar. `lib/recordatoriosAgrupar.js` y `lib/usePersonasActivas.js`
sacan a un solo lugar lógica que antes estaba duplicada entre la página y el
panel nuevo.

Primera pieza de la capa de datos intercambiable: `lib/dataProvider.js`
(`dataProviderReal` detrás de un Context, con valor por defecto, así que la
app real no necesita envolver nada).

### Modo demo (`/demo`)
Reusa los componentes reales (`Home`, `PersonasPage`, la vista completa de
Recordatorios, el panel, el reloj) en vez de copiarlos — lo único que
cambia es la capa de datos: `/demo` envuelve su árbol con
`DataProviderProvider` pasando `lib/dataProviderDemo.js`, un CRUD en
memoria con la misma interfaz que `dataProviderReal` (mismos métodos,
mismas formas de dato, mismo "tira `Error` con `.message` si falla").
`lib/demoData.js` genera 8 jugadores, 6 alumnos y 6 recordatorios con
fechas relativas a "hoy" en hora Argentina (`hoyArgentinaISO`), con tests
que confirman que siempre hay al menos un atrasado y un vencimiento
próximo — con una excepción conocida y documentada en el código: el día 1
de un mes nadie puede mostrar "Atrasado" todavía, por la propia regla de
`cuotaAtrasada` (no puede haber pasado un vencimiento antes de que el mes
empiece).

`AuthGate.js` corta para `pathname === "/demo"` antes de tocar Supabase (ni
siquiera el `getSession()` inicial, que puede disparar un refresh de token
por red). `app/page.js` (Home) y `PersonasPage.js` suman props opcionales
(`onNavegar`, `onIrARecordatorio`, `rutaRecordatorios`) para que sus links
internos cambien de pestaña dentro de `/demo` en vez de navegar de verdad
(una navegación de página completa perdería los datos en memoria); sin esos
props, que es como los usa la app real, el comportamiento es idéntico al de
antes.

Banner morado permanente ("Modo demo: los datos son de ejemplo" + botón
Reiniciar), marca de sidebar y título de pestaña propios, para que sea
imposible confundirlo con la app real. Exportar CSV y "Recordar"
(WhatsApp/mailto) siguen andando, sobre datos claramente ficticios.

**Simplificación aceptada**: en `/demo`, el link "Recordatorio" de una fila
de persona cambia de pestaña (no pierde los datos en memoria) pero no
prellena esa persona en el formulario — a diferencia de la app real, que sí
lo hace vía query params. El link a la persona asociada dentro de una fila
de recordatorio tampoco se adaptó (queda apuntando a la ruta real,
gateada); es un link secundario, no la ruta principal del recorrido.

### Bug encontrado y corregido en el momento
`lib/dataProvider.js` armaba la ruta de la API pluralizando a mano
(`${tipo}s`): funciona para "alumno" → "alumnos", pero da "jugadors" para
"jugador" (pluralización irregular en español). Se encontró recorriendo el
dashboard real en el navegador (el error mostraba "Unexpected token '<' ...
is not valid JSON" porque el fetch a la ruta inexistente devolvía la página
404 en HTML). Se corrigió con un mapeo explícito `{ jugador: "jugadores",
alumno: "alumnos" }` en vez de pluralizar a mano.

### Cómo se verificó
- En navegador real, con la sesión real y con `/demo`: reloj con la hora
  real de las 4 ciudades (comparada contra el reloj del sistema); alta
  rápida de un recordatorio desde el panel aparece también en
  `/recordatorios` sin recargar, y viceversa; plegar el panel persiste tras
  recargar la página; marcar/desmarcar un pago con la sesión real (se
  encontró y corrigió el bug de pluralización de arriba); alta de un
  jugador TEST, borrado real por API al terminar (sin tocar `juanjo` ni
  `facu`); recorrido completo de `/demo` (Inicio → Jugadores → Alumnos →
  Recordatorios) sin salir de la pestaña; marcar un pago y crear un
  recordatorio en `/demo` quedan solo en memoria; pestaña Network de Chrome
  confirmando cero requests a `/api` o a Supabase durante todo el
  recorrido de `/demo`; consola sin errores ni warnings de hidratación;
  `/errores` vacío después de toda la sesión.
- `npm test` (46 tests) y `next build` limpios después de cada commit.
- **No verificado en navegador**: el cajón mobile del panel y la grilla 2x2
  del reloj en pantalla angosta — la herramienta de redimensionar la
  ventana del navegador automatizado no tuvo efecto visual en esta sesión;
  quedaron verificados por revisión de código y por seguir el mismo patrón
  de breakpoint (`@media (max-width: 860px)`) que ya usa el resto de la
  app. Tampoco se disparó `window.print()` de verdad (ya había bloqueado el
  navegador automatizado una vez con un `window.confirm` nativo); se
  confirmó por código que el reloj, el panel y el banner de demo quedan
  fuera de `.print-area` y por lo tanto ocultos al imprimir.

## Undécima pasada — auditoría completa y rediseño visual
Capturas del «después» en [`docs/capturas/`](./docs/capturas/)
(`despues-*.jpg`; las de «antes» se quitaron en la verificación del código).

### Auditoría: base de datos
- **Hallazgo grave, no aplicado (toca Auth):** el registro público de
  usuarios está habilitado y todas las políticas RLS son
  "authenticated → true": cualquiera puede crearse una cuenta y ver todo.
  Arreglo y propuesta de SQL en el README ("Riesgo abierto").
- 6 tablas con RLS activo, ninguna sin políticas; `anon` tiene permisos de
  tabla pero ninguna política, así que no ve nada (verificado: sin sesión
  la API devuelve 401).
- Integridad referencial correcta: cuotas en cascada al borrar la persona,
  recordatorios quedan sin persona (SET NULL), checks de estado/tipo/día.
- Índices: cubren las consultas reales (cuotas por mes, historial por
  persona y mes, recordatorios pendientes por fecha). Asesor de
  performance de Supabase: sin avisos. Asesor de seguridad: solo "leaked
  password protection" desactivado.

### Auditoría: API
- Jugadores y alumnos unificados en `lib/rutasPersonas.js` (eran seis
  archivos casi idénticos).
- Validación de forma que faltaba: ids no-uuid, mes y fechas inválidos,
  largos sin tope, montos absurdos, JSON roto. Antes todo eso llegaba a
  Postgres y volvía como 500 con el mensaje técnico crudo en pantalla.
- El mes de una cuota se normaliza al día 1: con "2026-09-15" se podía
  crear una segunda cuota del mismo mes esquivando el unique.
- Errores de base traducidos a castellano; los inesperados ahora sí quedan
  en `errores_app` (antes solo las excepciones, así que `/errores` casi
  nunca mostraba nada — de hecho, así apareció el PGRST303 de abajo).
- `hecho_en` de recordatorios guarda la hora real y se muestra en hora
  Argentina.
- Verificado contra la base real con 16 pedidos malformados.

### Auditoría: relojes (corrige la pasada anterior)
El reloj de la máquina de desarrollo está ~55 s atrasado (medido contra
Google y los gateways de Supabase). La conclusión anterior ("Supabase emite
tokens adelantados") estaba mal; ver `docs/INFORME-NEXT-16.md`. PostgREST
igual rechazó un pedido con `PGRST303` una vez: mecanismo no confirmado,
mitigado con reintento seguro (503 reintentable + `apiFetch`).

### Auditoría: frontend
Encontrado y corregido:
- Mobile (primer recorrido en un viewport real de 390 px): la página entera
  desbordaba 70 px de costado por el nav; el cajón mostraba dos controles
  de cierre; "Cerrar sesión" tapaba contenido; si se plegaba el panel en la
  compu, el cajón del celular se abría vacío.
- El dashboard no se enteraba de un recordatorio marcado en el panel.
- Cambiar de mes rápido podía mostrar datos de otro mes; el "Deshacer"
  recargaba el mes equivocado.
- Un monto borrado se guardaba como $0 sin avisar.
- "Todavía no hay jugadors cargados".
- "Recaudado este mes" mirando otro mes.
- Login: "contraseña incorrecta" también sin conexión; un 401 cerraba la
  sesión en todos los dispositivos; "Cerrar sesión" sin red no hacía nada.
- Al abrir el cajón de recordatorios el foco quedaba atrás.
- En `/demo`, "Ver todos" del panel sacaba de la demo.
- El shell medía 30 px más que la ventana ("Ver todos" cortado).
- Pérdidas de memoria: no se encontraron (intervalos, listeners y
  suscripciones estables tras 36 navegaciones; memoria bajó en vez de
  subir).

### Diseño
Fondo vivo tipo aurora, grano, vidrio con canto de luz, elevación al
pasar el mouse, íconos SVG, navegación sin recarga con transición de
entrada, conteo de montos, anillo de "% cobrado", pago optimista con
confirmación (check + pulso, ~200 ms medidos contra el servidor real),
barra de abonado que se llena, esqueletos en todas las cargas, cajón
mobile que desliza, estados vacíos con acción y bienvenida de primer uso.
Detalle y criterios en el README ("Decisiones de producto").

### Cómo se verificó
- En navegador real (Chrome, sesión real contra la base, datos TEST
  borrados de verdad al final; la base quedó en 0 filas en las 6 tablas):
  todo lo de arriba, más el recorrido mobile en viewports de 390 px
  embebidos (las media queries se evalúan contra el ancho del iframe, es
  render mobile real), foco y Escape del cajón, conteo muestreado cuadro
  a cuadro (así apareció y se corrigió un "$-1.582" en el primer cuadro),
  confirmación de pago con un observador del DOM, "hecho"+"deshacer" a 10 ms
  de distancia con estado final igual en pantalla y servidor, consola sin
  errores ni avisos de hidratación, pestaña Network de `/demo` sin pedidos
  a la API ni a Supabase.
- `npm test` (60 tests) y `next build` limpios.
- **No verificado en vivo:** `prefers-reduced-motion` (el navegador
  automatizado no permite emularlo; verificado por código en los tres
  lugares: CSS, `MotionConfig` y `useMenosMovimiento`), la impresión real
  (por código: reloj, panel, banner y grano quedan fuera de `.print-area`),
  un teléfono físico, y el flujo completo de "olvidé mi contraseña".

## Pasada 2026-09-29 (tarde) — tanda pendiente y preparación para Netlify

Al retomar se comprobó (git log, código, docs) que la tanda anterior
**no se había empezado**: ningún commit ni cambio local de los 4 ítems. Se
hicieron ahora, uno por commit:

- **WhatsApp en formato internacional** (`lib/telefono.js`): normalización
  de celulares argentinos a `549` + 10 dígitos, validada en backend y modal.
- **Fechas siempre en hora Argentina** (`lib/fechas.js`): además arregló un
  bug real del backend: en un servidor UTC, `cuotaAtrasada` marcaba atrasada
  una cuota desde las 21 h del propio día de vencimiento (reproducido con el
  código viejo y `TZ=UTC`).
- **ESLint** (`next lint`, `next/core-web-vitals`): el código pasa limpio.
- **Sesión vencida sin perder el formulario**: login encima de la app inerte.
- **Netlify**: `netlify.toml` + `@netlify/plugin-nextjs` 5.16.0 fijado;
  build verificado con `netlify build --offline` y servido con
  `netlify serve --offline`. Checklist de Vercel reemplazado.

### Hallazgos (no causados por esta pasada, no modificados)
- Las políticas RLS de la base se cambiaron fuera del repo a "solo admins"
  (`app_admins`), pero `app_admins` tiene RLS sin políticas: el usuario no ve
  su propia fila y la app no puede leer ni guardar nada. Arreglo sugerido en
  el README; no se aplicó.
- El registro público de Auth sigue habilitado.
- La CLI de Netlify de esta máquina ya tenía una sesión iniciada; no se usó.

### Cómo se verificó
- En Chrome contra `next dev`: aviso de teléfono incompleto y vista previa
  del formato; backend rechaza `2345-6789` con 400; token corrompido a
  propósito → login encima con el modal y sus 4 campos intactos, fondo
  `inert`, Escape sin efecto, foco en contraseña; reingreso de la misma cuenta
  (restaurando la sesión real) → modal intacto; "Entrar con otra cuenta" →
  login normal sin la app. En `/demo`: alta con `0351 15 234-5678` →
  `wa.me/5493512345678`.
- Sobre el runtime de Netlify (`netlify serve`): rutas API sin token → 401,
  método no exportado → 405, `/demo` y login en el navegador sin errores de
  consola.
- `npm test` (79 tests, también con TZ=UTC/Tokio/Los Ángeles/Kiritimati),
  `npm run lint` y `next build` limpios.
- **No verificado:** un alta real guardada en la base (bloqueada por la RLS
  de arriba), las rutas API autenticadas sobre el runtime de Netlify, el
  deploy real.

## Pasada 2026-09-29 (noche) — saludo al iniciar sesión

- Se sacó el saludo fijo con el nombre de la clienta del dashboard (ahora "Inicio").
- Saludo de una sola vez al loguearse, con nombre según el email
  (`NOMBRES_POR_EMAIL`: `admin@ejemplo.com` → la administradora) y hora argentina.

### Cómo se verificó
- En Chrome: al abrir la app ya logueada no aparece. Login simulado
  (paso de sin sesión a con sesión con la sesión real de la cuenta de
  prueba, hora fijada) → "Buenos días / Buenas tardes / Buenas noches" +
  "¡Hola de nuevo!"; se cierra solo antes de 3 s; repetir con la misma
  sesión no lo vuelve a mostrar; un click en "Jugadores" durante el saludo
  navega y lo cierra; Escape lo cierra. Caso de la administradora: el email real no se
  puede usar, así que se mostró el overlay con el texto que devuelve
  `textoBienvenida("admin@ejemplo.com", …)` en los 3 horarios (y los 3
  están en los tests). Mobile en un iframe de 390 px: centrado, sin
  desborde. Consola sin errores.
- Hallazgo de la prueba: si el token parece vencido al momento del evento,
  supabase-js emite `TOKEN_REFRESHED` y no se saluda (correcto: no es un
  login nuevo).
- **No verificado en vivo:** `prefers-reduced-motion` (el navegador
  automatizado no lo emula; lo cubre el bloque global de `diseno.css` y el
  cierre sin demora de `useMenosMovimiento`), un login real con contraseña.

## Pasada 2026-10-04 — rediseño visual y fluidez (tanda 1 de 3)

Alcance: sistema visual nuevo según `docs/referencia-rediseno.html`, una sola
barra lateral, Inicio nuevo, atajos, buscador Ctrl+K, registrar cobro con
método de pago. Gastos y coaches quedan para las tandas 2 y 3. No se modificó
la base ni el esquema.

### Hecho
- **Migraciones**: se trajeron a `supabase/migrations/` las aplicadas desde
  fuera del repo, sin reaplicarlas. Son 4, no 3: además de las tres pedidas
  (`fase1_gastos_categorias_pagos_comprobantes`,
  `fase2_certificaciones_coaches_liquidacion`, `liquidacion_singular_plural`)
  faltaba `bloquear_registro_no_permitido` (20260930000255). El SQL salió de
  `supabase_migrations.schema_migrations` (solo lectura).
- **Estilos**: `globals.css` pasó a ser la única hoja, con los tokens en
  `:root`. Se borraron `diseno.css`, el fondo animado, el grano, el anillo de
  porcentaje y el conteo animado de números.
- **Estructura**: una sola barra lateral (Inicio; Cobros; Agenda con
  contador; usuario y cerrar sesión), barra superior con vidrio (título,
  buscador, relojes en una línea, "+ Nuevo"), cajón en el celular. Se eliminó
  el panel de recordatorios de la derecha.
- **Inicio**: saludo, fecha, selector de mes, resultado del mes, gráfico de 6
  meses, Por cobrar / Gastos por pagar / Certificación, y "Para hacer hoy".
  Nueva ruta `GET /api/resumen` (solo lectura).
- **Fluidez**: "+ Nuevo", atajos C/N/R, Ctrl+K, registrar cobro en ventana
  con efectivo o transferencia (`metodo_pago`), mes recordado entre pantallas.
- **Tablas**: columna Método (editable) y Método de pago en el CSV; en el
  celular cada persona es una tarjeta en una columna.
- Se quitó `framer-motion` (solo lo usaba el panel borrado).

### Diferencias con la referencia (y por qué)
- Las etiquetas de sección de la barra lateral usan el color secundario, no
  el texto al 42 %: medido, ese valor daba 3,48:1 y no llega a AA.
- Se agregó una leyenda (Ingresos / Gastos) bajo el gráfico, que no estaba.
- "Buscar persona o sección" en lugar de "o categoría": las categorías de
  gastos llegan en la próxima tanda.
- El chevron de los desplegables es un ícono SVG, no el carácter "▶".
- El despliegue usa `grid-template-rows` (0fr a 1fr) en vez de `max-height`
  fijo, para que un tercer nivel no se recorte.
- La entrada de página usa `backwards` en vez de `both`: un transform que queda
  puesto rompe el `position: fixed` de las ventanas.
- Pendiente de tono: el estado "Pendiente" de las tablas pasó de ámbar a
  neutro (alerta queda para atrasado).

### Cómo se verificó
- **En vivo (Chrome sin cabeza, contra `/demo` en `next dev`)**: menú "+ Nuevo",
  atajos C, N y R (y que no se activan escribiendo en un campo), Ctrl+K con
  flechas y Enter (lleva a la tabla con el nombre filtrado), registrar cobro
  desde "Para hacer hoy" (exige método, cierra y avisa con Deshacer), mes
  recordado al cambiar de pantalla, cajón del celular (abre y cierra con
  Escape), desplegables de 3 niveles con un árbol de prueba temporal
  (recuerdan lo abierto tras recargar), duraciones de movimiento normales y
  con `prefers-reduced-motion`, contraste medido sobre los colores
  calculados de cada pantalla (todo en AA), y que `/demo` no hace ningún
  pedido a la API ni a Supabase. Consola sin errores. Capturas en
  `docs/capturas/` (`despues2-*`, a 1440 y 390 px; las `antes2-*` se quitaron
  en la verificación del código).
- `npm test` (125 tests), `npm run lint` y `next build` limpios.
- **No verificado en vivo**: nada con sesión real. La extensión de Chrome no
  estaba conectada y no hay credenciales de prueba; por eso Inicio con datos
  reales, `/api/resumen` contra la base, guardar `metodo_pago` por la API y las
  pantallas `/errores` y recuperar contraseña con sesión no se vieron
  funcionando. Lo leído: la sintaxis de las 3 consultas de `/api/resumen` se
  comprobó con GET anónimos a PostgREST (200, vacío por RLS) y el esquema de
  `metodo_pago` con `list_tables`. Un intento de probar el upsert con filas
  TEST en la base fue rechazado y no se corrió: no quedó ninguna fila TEST.
- El mes elegido en `/demo` cambia la etiqueta pero las cuotas en memoria son
  las mismas (limitación vieja de la demo).

## Pasada 2026-10-04 (tarde) — ajuste de escala y espacio del Inicio

Sin cambios en datos ni esquema.

### Hecho
- **Escala desde los tokens** (`app/globals.css`): base 15 px, menú lateral
  14,5 px con ítems de 40 px y barra de 248 px, etiquetas 13 px, cifras 28 px,
  resultado del mes 52 px, saludo 34 px, títulos 22 px, tarjetas con 26 px de
  padding y separaciones de 20 px. Tablas, ventanas y celular revisados con la
  escala nueva.
- **Inicio en grilla fluida** hasta 1680 px: resultado del mes + gráfico de 220
  px con monto al pasar el mouse (o enfocar con teclado); cuatro tarjetas, con
  la nueva "Cobrado en el año" (por fecha de pago); "Para hacer hoy" más ancho
  y, a la derecha, "Próximos 7 días" y "Últimos movimientos" (los últimos 6
  cobros y pagos con fecha, persona o categoría, monto y método). Debajo de
  1200 px esa columna baja debajo de "Para hacer hoy"; en el celular todo va en
  una columna.
- `GET /api/resumen` suma `cobradoAnio`, `proximos` y `movimientos` (solo lectura).
- Bloque de usuario de la barra lateral: nombre y mail en una línea cada uno,
  el mail con puntos suspensivos, y "Cerrar sesión" en su propia línea.
- Saludo: `dev@ejemplo.com` es "Facu".
- Celular: botones, campos y los badges/lápices de las tablas llegan a 40 px; el
  título de página puede ocupar dos líneas y "+ Nuevo" no se parte.

### Decisiones
- "Próximos 7 días" cuenta de mañana a +7: lo de hoy ya está en "Para hacer hoy".
  Los recordatorios que se muestran ahí son los no hechos de esas fechas.
- Un gasto fijo con monto sin cargar aparece como "Sin monto" en lugar de US$ 0.
- Los pagos de gasto aparecen en "Últimos movimientos" con signo menos y los
  cobros con signo más.

### Cómo se verificó
- **En vivo (Chrome sin cabeza contra `/demo`)** a 1920, 1440, 1024 y 390 px
  (capturas `docs/capturas/escala-*`): tamaños y espacios medidos en el
  navegador contra los pedidos (15, 14,5, 40 px, 248 px, 13, 28, 52, 34, 22, 26,
  20, contenido de 1672 px a 1920), tooltip del gráfico, bloque de usuario con un
  mail largo (una línea, truncado), sin scroll horizontal y sin controles de
  menos de 40 px en el celular, y de nuevo los atajos, Ctrl+K, cobro, mes y
  cajón. `npm test`, `npm run lint` y `next build` limpios.
- Las 6 consultas nuevas de `/api/resumen` (embeds, `in`, `not.is.null`, orden)
  se comprobaron con GET anónimos a PostgREST (200, vacío por RLS).
- **No verificado**: Inicio con datos y sesión reales (sigue sin haber
  credenciales de prueba); "Próximos 7 días" y "Últimos movimientos" se vieron
  con los datos de ejemplo de `/demo`, que usan las mismas funciones puras.

## Tanda 2 — Gastos, y ajustes de la tanda 1

### Ajustes previos
- `netlify.toml` commiteado con las dos variables públicas de Supabase.
- Resultado del mes: lo **cobrado** cuenta por fecha de pago (una cuota de
  septiembre cobrada el 3 de octubre es de octubre), igual que lo gastado. Una
  cuota pagada sin fecha cuenta por su mes. Las tablas de Jugadores y Alumnos
  siguen por mes de la cuota. En los datos reales eso mueve los US$ 10.000 de una
  cuota de septiembre cobrada el 1 de mayo al mes de mayo del gráfico.
- Ventana de cliente: el monto mensual arranca vacío, es obligatorio y muestra un
  ejemplo en gris (se sacaron los 15000 y 10000 del código).
- README: `app_admins` sin política es intencional, el registro público lo
  bloquea el trigger de `auth.users` y el sitio ya está publicado en Netlify; los
  tres salieron de los riesgos.

### Gastos
- **Barra lateral**: la sección Gastos sale de la base (hasta 3 niveles), con
  "Todos los pagos" y "Administrar categorías". Un grupo es un enlace a su página
  y se despliega con la flecha. Punto de vencimiento dorado (vence en 7 días) o
  ámbar (vencido), que en un grupo suma lo de sus subcategorías.
- **Página de categoría** (`/gastos/<id>`) y de todos los pagos (`/gastos`):
  historial (con subcategorías si es un grupo, cada fila con su ruta), totales
  del mes y del año por fecha de pago, estado del período en las recurrentes,
  Imprimir y Exportar CSV con la ruta completa.
- **Registrar pago** (atajo G, "+ Nuevo" y "Para hacer hoy"): fecha de hoy,
  monto precargado con el estimado, efectivo o transferencia obligatorio,
  proveedor y descripción, período que se completa solo (se puede cambiar a un
  mes anterior) y comprobante opcional. Editar y eliminar.
- **Comprobantes**: tipo y tamaño validados en el navegador y de nuevo en el
  servidor (que además mira los primeros bytes); URL firmada de 60 s; al eliminar
  un pago se borra el archivo.
- **Administrar categorías**: agregar, renombrar, ordenar (↑ ↓), configurar
  mensual o anual con monto y vencimiento, desactivar (la rama completa) y
  borrar solo sin pagos ni subcategorías; con pagos explica que puede
  desactivarla. Profundidad máxima de 3 niveles validada en el servidor. Las dos
  categorías con `clave` se renombran pero no se desactivan, mueven ni borran.
- **Integración**: gastos fijos en "Para hacer hoy" (con "Registrar pago") y en
  "Próximos 7 días"; categorías en Ctrl+K; `/demo` con árbol y pagos de ejemplo
  en memoria.
- **Rutas API**: `/api/categorias-gasto`, `/api/pagos-gasto` y
  `/api/pagos-gasto/[id]/comprobante`, con sesión real, RLS, validación en el
  servidor y errores en castellano registrados en `errores_app`.

### Decisiones
- "Para hacer hoy" muestra los gastos fijos sin pagar que ya vencieron o que
  vencen dentro de 7 días (como "Pagar Wifi, En 6 días" de la referencia). Los de
  mañana en adelante también están en "Próximos 7 días".
- Sin día de vencimiento, un gasto mensual vence a fin de mes.
- **Vencimientos anteriores a la creación de la categoría** (`created_at`) no
  cuentan como vencidos ni avisan: son períodos previos al uso del sistema y no
  hay forma de saber si se pagaron. Aplica a Para hacer hoy, Próximos 7 días, el
  indicador, "Gastos por pagar" y la página de la categoría ("Sin seguimiento").
  Zoom (anual, julio) avisa recién en julio de 2027.
- Los pagos solo se registran en categorías sin subcategorías activas; una
  categoría con pagos no pasa a ser grupo y una recurrente no tiene subcategorías.
- Los pagos que generó una liquidación (`modulo_id`) no se editan ni borran desde
  esta pantalla.
- `equipo_id` y `modulo_id` no se usan todavía (tanda 3).

### Cómo se verificó
- **En vivo, con la sesión real de Facu contra la base real** (Chrome, app local
  en `localhost:3000`):
  - Inicio con datos reales: Por cobrar US$ 14.799 (5 personas), cobrado del año
    US$ 12.799, resultado de octubre US$ 0, y en Próximos 7 días las 5 cuotas del
    día 10 más Wifi y Celulares. Zoom no aparece vencido.
  - Cliente TEST: la ventana arranca con el monto vacío y no deja guardar sin
    monto. Cobro TEST de US$ 10 con transferencia: el resultado de octubre pasó a
    US$ 10 y el cobro entró en Últimos movimientos.
  - Pagos TEST: Wifi (US$ 1, con comprobante), Zoom (US$ 2) y uno suelto en
    Consultora de marketing (US$ 3). El resultado quedó en US$ 4 (cobrado 10,
    gastado 6), el gráfico mostró octubre con ingresos 10 y gastos 6, Wifi salió
    de Para hacer hoy y del indicador, y Zoom quedó "pagado" en 2026.
  - Comprobante: se subió, se abrió con la URL firmada y la URL pública del
    bucket devuelve 400 (privado). El servidor rechazó un PNG falso (contenido de
    otro tipo), un zip y un archivo de más de 5 MB.
  - Subcategoría TEST: creada, renombrada y desactivada. El servidor rechazó el
    cuarto nivel, borrar una categoría con pagos (explica que puede desactivarla),
    desactivar y borrar una categoría con `clave`, un pago sin método y un pago en
    un grupo.
- **En vivo (Chrome sin cabeza contra `/demo`)**: registrar un pago desde "Para
  hacer hoy" (categoría y período precargados), archivos inválidos con su mensaje,
  Ctrl+K con categorías, borrar con pagos, alta de una subcategoría en el menú.
- **Solo leído o con tests, sin probar en vivo**: eliminar un pago con comprobante
  (la regla de borrar el archivo está en el código y la prueba de la demo cubre
  el borrado del pago, pero no se borró ningún pago real por la consigna de no
  borrar los TEST); editar un pago; reemplazar o quitar un comprobante; el cajón
  del celular con la sección Gastos; el CSV y la impresión de gastos (se leyó el
  código, no se descargó el archivo); el resultado de un mes con pagos de gasto
  distintos de octubre.
- `npm test` (213 tests, incluida la regla de `created_at`), `npm run lint` y
  `next build` limpios.

## Tanda 3 — Módulo de certificación y equipo de coaches

### Paso 0
- `fase2_certificaciones_coaches_liquidacion` y `liquidacion_singular_plural` ya
  estaban en el repo: se compararon con lo aplicado en Supabase (md5 idéntico).
- `fase3_proteccion_pagados_pendientes_estado_modulos` se trajo de
  `supabase_migrations.schema_migrations` (sin reaplicar) y se comprobó que el
  archivo es idéntico (md5 y largo).

### Qué se hizo
- Rutas API de certificaciones, módulos, encuentros, sesiones, inscripciones,
  equipo y liquidaciones, con sesión real, RLS, validación en el servidor y las
  RPC de la base. Los errores intencionales de la base (`P0001`) salen tal cual.
- Pantallas: resumen y pendientes, módulos, planilla del módulo (encuentros,
  prácticas finales, sesiones, lo que se paga y liquidar), avance de alumnos,
  ficha del alumno, equipo y ficha de cada persona.
- Integración: Para hacer hoy (módulo listo, pagos tardíos, listo para
  certificar), tarjeta de Inicio, Gastos (pagos de liquidación: no se editan, se
  eliminan con la explicación de que vuelven a pendiente), Ctrl+K (equipo,
  alumnos inscriptos, módulos), "+ Nuevo" y atajo S para "Marcar sesión
  realizada", CSV de liquidaciones y de avance.
- `/demo` con una certificación de ejemplo en memoria y la misma lógica de
  liquidación en JavaScript.
- Tests: lógica de la demo y de las validaciones de rutas con los números del
  caso de referencia (260 tests en total).

### Cómo se verificó
- **En vivo, con la sesión real de Facu contra la base real** (Chrome, app
  local), con datos TEST:
  1. Certificación TEST con tarifas 50/40/60 (se crearon sus 10 módulos), equipo
     de 3 personas TEST, 2 alumnos TEST creados con la ventana de cliente e
     inscriptos con la coach TEST (10 sesiones cada uno).
  2. Módulo 1: profes asignados, 4 encuentros dictados (el 4 con tarifa especial
     de 100), sesión de TEST Alumno Uno realizada con la fecha de hoy. El módulo
     pasó a "Listo para liquidar" y apareció en Para hacer hoy como "Módulo 1
     listo para liquidar · US$ 270 para 3 personas".
  3. Resumen de pago igual al caso de referencia (coach 50, profe B 80, profe C
     140). Se liquidó con transferencia y doble clic: 3 pagos en Gastos (no 6),
     módulo liquidado, 5 ítems con "Pagado" y controles bloqueados.
  4. La sesión del módulo 1 de TEST Alumno Dos, marcada después con el atajo S,
     quedó como pendiente de 50 (bloque del resumen y Para hacer hoy).
     "Liquidar pendientes" creó 1 pago; llamarlo de nuevo devolvió 0.
  5. Cambio de coach de TEST Alumno Uno: la sesión hecha (y pagada) del módulo 1
     quedó con la coach anterior; las 9 pendientes pasaron al nuevo.
  6. Cambiar la tarifa de un encuentro pagado o desmarcar una sesión pagada
     devolvió 409 con el mensaje de la base; la fecha sí se pudo cambiar.
     Eliminar en Gastos el pago de 140 (la confirmación explica que vuelve a
     pendiente) dejó los encuentros 3 y 4 pendientes y los US$ 140 en el bloque
     de pendientes.
  7. Práctica final en el módulo 3: 400 con "Las prácticas finales solo pueden
     estar en los módulos 9 y 10". Cinco prácticas desde la pantalla (3 en el 9,
     2 en el 10) y la sexta mostró "Una certificación tiene como máximo 5
     encuentros de práctica final".
  8. Escritorio a 2560 px de ancho; 390 px con la misma sesión dentro de un
     iframe de 390 px (Chrome estaba maximizado y no se pudo achicar): planilla,
     avance, resumen, equipo e Inicio sin scroll horizontal.
  - Sin errores nuevos en `errores_app` durante la verificación.
- **En vivo en /demo (Chrome sin cabeza)**: Para hacer hoy con el módulo 3 listo y
  el pendiente tardío, liquidar con doble clic (5 pagos), bloqueo "Pagado",
  buscador, ficha de una persona, 390 px sin scroll horizontal.
- **Hallazgo durante la prueba**: un intento de tarifa especial no se guardó,
  pero era la herramienta de prueba (no le daba el foco al campo); con un clic
  real, tipear y Tab, se guarda y se vuelve a vaciar bien.
- **Solo leído o testeado, sin probar en vivo**: borrar una persona del equipo
  con historial (el servidor responde con la explicación; testeado en la demo),
  desactivar o editar personas, editar las tarifas de la certificación, el
  aviso "Listo para certificar" (requiere 10 de 10), los CSV descargados, la
  ficha de una persona con datos reales, el selector con varias certificaciones,
  el cajón del celular con la sección Certificación.

## Auditoría completa (2026-10-05)

Informe detallado, con cada hallazgo clasificado y lo verificado en vivo, en
[`docs/AUDITORIA.md`](./docs/AUDITORIA.md). Lo que se cambió:

- **Pagos de liquidación**: ahora se pueden corregir fecha, método, proveedor,
  descripción y comprobante; el servidor rechaza cambiar monto, categoría,
  persona o módulo, con un mensaje claro. La planilla de liquidaciones busca
  los pagos por los ítems que cubren, no por la descripción.
- **Doble envío**: candado inmediato en las 10 ventanas que crean o guardan.
  Antes, tres clics rápidos creaban tres pagos o tres clientes.
- **Encabezados** (`next.config.mjs`): `/api` con `Cache-Control: private,
  no-store`; el sitio con `nosniff`, `Referrer-Policy`, sin iframes de otros
  sitios y sin `X-Powered-By`.
- **Impresión legible** (antes salían casi en blanco el título, los montos, las
  fechas y los métodos).
- **CSV**: protección contra fórmulas de Excel y nombres de archivo sin tildes.
- **Detalles**: `/api/errores` responde 400 a un cuerpo roto; horas del
  registro de errores en 24 horas; rótulos de las tablas de cuotas; etiqueta
  accesible del comprobante.
- **Rendimiento**: el resumen de la certificación se lee en paralelo
  (`/api/resumen` pasa de ~1,2 s a ~0,4 s).
- **Tests nuevos**: límites de fechas, carga simulada (200 clientes, 500
  pagos), CSV, `leerJson`/`errorDeBase` y contraste de los textos nuevos
  (286 en total).
- **README**: corregido lo que estaba desactualizado, incluida la afirmación de
  que los tests se habían corrido en otros husos (en Windows, Node solo
  respeta `TZ=UTC`).

