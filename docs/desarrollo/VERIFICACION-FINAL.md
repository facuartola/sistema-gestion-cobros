# Verificación final antes de publicar

Fecha: 2026-10-05. Revisión como si fuera externa: cada punto se probó contra la app
real (`next start` sobre la base real, con sesión real) o contra una base Postgres en
memoria, salvo donde se aclara "solo leído". Datos de prueba con prefijo TEST (lista al
final). Sin push ni deploy.

## Resumen

- **Críticos: ninguno.** Registro bloqueado, RLS cerrada (la clave pública no lee ninguna
  tabla ni ejecuta el pago al equipo), pagos al equipo atómicos y protegidos.
- **Altos (los 3 primeros, arreglados):**
  1. "Para hacer" **no se podía ocultar** (lo pidió la clienta). Arreglado.
  2. La API aceptaba **fechas de pago futuras** (un cobro "pagado" en 2031 se guardó) y
     cuotas de años adelante: inflaban "cobrado". Arreglado, con tests.
  3. Al abrir el **panel del cliente con teclado el foco seguía en la página de atrás**.
     Arreglado y comprobado.
  4. `npm audit` deja 1 crítico y 2 altos en lo que se publica (`next` 14.2.35 y sus
     dependencias). Sin parche en la rama 14; **se propone** planificar la actualización.
- Medios y bajos: ver la tabla de hallazgos.

## Parte 1. ¿Hace lo que pidió la clienta?

| # | Pedido | Dónde está | Estado | Qué hay que hacer |
|---|---|---|---|---|
| 1 | Cuotas por mes (pagada / por cobrar), día de vencimiento, monto propio, monto total y barra en alumnos, todo editable | Cobros (pestañas Jugadores y Alumnos de la certificación) + panel de cada persona | **Cumple** | Probado: la barra dice "US$ 600 de US$ 3.000"; el monto y el día se cambian en el panel (el monto nuevo vale para las cuotas nuevas). La barra solo aparece si el alumno tiene "monto total". |
| 2 | Gastos con la estructura pedida, editable, en dólares, efectivo/transferencia, comprobante opcional | Gastos; Configuración › Tipos de gasto | **Cumple** | La base tiene exactamente la estructura (Wifi y Celulares mensuales día 10, Zoom anual julio, marketing con 2 subtipos, diseño/desarrollo/mantenimiento, coaches con sesiones y encuentros). Foto y PDF probados (el archivo falso y el de 6 MB se rechazan). Falta cargar los montos (ver "Tareas del dueño"). "Del 1 al 10": hoy cada gasto tiene un solo día (10); confirmar con la clienta si querían un rango. |
| 3 | Certificación: 10 módulos × 4 clases con profes distintos, sesión por alumno con su coach, prácticas finales, tarifa común y especial, pago por módulo, cambio de coach, 10 sesiones para certificar, cálculo automático | Certificación (Módulos, Alumnos, Equipo) | **Cumple, con una parcial** | Probado con datos TEST: 4 clases y 2 sesiones por módulo con 2 alumnos; cálculo correcto (Profe A 2×35 = 70; Profe B 35 + 80 de tarifa especial = 115; coach 20 + 40 = 60); pagar un módulo dos veces → una sola vez (3 pedidos en paralelo: 1 gana, 2 dan "ya fue pagado"); cambio de coach deja lo ya hecho y pagado con el coach anterior; con 10/10 sesiones el alumno pasa a "listo para certificar". **Parcial:** las 5 prácticas finales no se crean solas: se agregan a mano en los módulos 9 y 10 (la base impide la sexta y las de otros módulos). Decisión de negocio: ¿crearlas automáticas o seguir manual? |
| 4 | Inicio profesional: gráficos, resumen, quién debe, próximos vencimientos, resultado; hueso, navy y dorado, vidrio y transiciones | Inicio | **Cumple** | Pero **abruma** (ver Parte 4) y un cliente de monto extremo aplasta el gráfico principal. |
| 5 | Fácil para quien no sabe de tecnología: 5 secciones, 3 botones, "Para hacer" ocultable, ayuda, sin barras de más | Menú lateral, Inicio, `/ayuda` | **Cumple** (tras arreglar) | "Para hacer" ahora se oculta y se muestra (se recuerda). Barras: ver `docs/desarrollo/BARRAS-DE-DESPLAZAMIENTO.md`. |
| 6 | Saludo según la hora de Argentina y relojes de Argentina, Miami, Paraguay y México | Inicio; barra superior | **Parcial** | Saludo: "Buenas noches, Facu" (con el mail de la administradora dice la administradora). Relojes: en escritorio se ve la hora de Argentina y las otras tres **aparecen al tocar el reloj**; **en el celular no hay ningún reloj**. Proponer: ponerlos en el menú del usuario del celular, o mostrar los cuatro juntos en escritorio. |
| 7 | Recordatorios internos; el sistema nunca le escribe a un cliente | Recordatorios, "+ Nuevo" | **Cumple** | Búsqueda en todo el código: no hay `mailto:`, `tel:`, WhatsApp, SMS ni plantillas de mensaje; el campo "Contacto" aclara "No se le envía nada". Las sugerencias solo precargan un recordatorio propio. |
| 8 | Marca "Coaching deportivo", ingreso con mail y contraseña, recuperar contraseña, registro público bloqueado | Pantalla de entrada | **Cumple** | Registro: el disparador en `auth.users` está activo y hay 2 mails permitidos, 2 administradores y 2 usuarios. "Olvidé mi contraseña" **solo leído en el código** (no se probó el envío del mail). Ver tareas del dueño (envío de mails). |
| 9 | CSV, imprimir, copia de seguridad, no pausarse | Cobros, Gastos, Certificación, Configuración, `/api/salud` | **Parcial** | CSV: cumple. Copia: cumple (probada, ver Parte 2). Imprimir: Cobros, Pagos de gastos y Ayuda; **Certificación no tiene "Imprimir"**. Mantener activo: ruta probada; la función programada **no se vio correr en Netlify**. |

## Hallazgos

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| H1 | Alto | "Para hacer" no se podía ocultar | **Arreglado** (commit 95c36d5) |
| H2 | Alto | La API aceptaba cobros y pagos con fecha futura o de 1999 y cuotas de 2031 (la cuota "pagada" de 2031 quedó guardada; se sumaba a "cobrado") | **Arreglado**: fecha de pago ≤ hoy y ≥ 2020; mes de la cuota hasta 12 meses adelante. Incluye pagos de gasto y la edición de la fecha de un pago al equipo (esta última se encontró probando). Tests en `lib/fechasDePago.test.js`. |
| H3 | Alto | El foco no entraba al panel lateral (teclado) | **Arreglado y comprobado**: foco al panel, Tab no se escapa, Escape devuelve el foco a la fila |
| H4 | Alto | `npm audit`: `next` 14.2.35 (crítico) y `postcss`/`source-map-js` (altos) | **Se propone** actualizar Next (`docs/desarrollo/INFORME-NEXT-16.md`). No hay parche en la rama 14. La superficie afectada (imágenes optimizadas, rewrites, Server Actions, middleware) no se usa. |
| H5 | Medio | El Inicio abruma (ver Parte 4) | **Se propone** versión liviana |
| H6 | Medio | Un solo cliente de monto extremo (US$ 900.000) deja los otros meses del gráfico en altura 0 y la variación decía "▲ 49956 %" | Porcentaje **arreglado** (tope "más de 999 %"). El gráfico **se propone** (escala con tope o aviso "hay un valor muy grande"). |
| H7 | Medio | "Te faltan cobrar … y tenés US$ 100 de gastos por pagar" no cuenta los gastos sin monto (Wifi, Celulares): la frase suena a que es todo | **Se propone** agregar "y 2 sin monto cargado" |
| H8 | Medio | Relojes: solo Argentina visible; en el celular ninguno | **Se propone** (ver pedido 6) |
| H9 | Medio | Envío del mail de recuperación y de contraseñas: el correo por defecto de Supabase tiene un tope muy bajo por hora | **Tarea del dueño** (SMTP propio si se usa mucho) |
| H10 | Medio | Prácticas finales manuales | **Decisión de negocio** |
| H11 | Medio | Las filas de la base original tienen una inconsistencia: la cuota de septiembre de "Fernando G" figura pagada el 2026-05-01. "Cobrado en el año" del Inicio (por fecha de pago) y el de Cobros (por mes de la cuota) por eso difieren (US$ 12.799 vs US$ 12.000 + el alumno); el pie de Cobros ya lo aclara | **Dato**: revisar esa fecha |
| H12 | Bajo | Con cero clientes el Inicio dice "No te falta cobrar nada este mes" y "Todos al día" (engañoso) | **Se propone** "Todavía no cargaste clientes" |
| H13 | Bajo | Los modales usan su propio candado (`enviando` + `useRef`) y no el hook `useCandado`; hace lo mismo (se probó el triple clic en copia y 3 pedidos paralelos a la API) | Dejado (sin riesgo) |
| H14 | Bajo | La API no es idempotente: dos pedidos iguales de un pago de gasto crean dos pagos (la pantalla lo evita; solo pasaría con dos pestañas a la vez) | Dejado |
| H15 | Bajo | `/api/salud` devuelve dos `Cache-Control` (el general de `/api` y el propio); no afecta | Dejado |
| H16 | Bajo | Sin `Content-Security-Policy` completa (solo `frame-ancestors`) ni HSTS en el servidor (HSTS lo pone Netlify en https) | Se propone una CSP en una tanda aparte |
| H17 | Bajo | Barras de avance sin `role="progressbar"` (el texto "US$ 600 de US$ 3.000" sí lo lee el lector) | Se propone |
| H18 | Bajo | README con textos viejos ("Para hacer hoy", "Próximos 7 días", "liquidar") de tandas anteriores | Se actualizó la parte de `npm audit` y CHANGELOG; se propone una pasada general |
| H19 | Bajo | Una prueba mía dejó 1 fila en `errores_app` ("e is not iterable", 2026-10-06 02:45 UTC): salió de simular respuestas vacías con datos mal armados, no de la app | Informativo |
| H20 | Bajo | `/errores` en celular tiene una tabla más ancha que la pantalla (scroll dentro de su tarjeta; la página no se desborda) | Dejado |

## Parte 2. Seguridad y datos

**Rutas de la API (31 `route.js`)**: todas dan 401 sin sesión salvo `salud`; lo verifica el
test `lib/rutasApi.test.js` y se probó con `curl` (jugadores, copia, recordatorios,
panorama → 401).

- **`/api/salud`**: solo `GET` (POST → 405). Responde `{"ok":true}` o `{"ok":false}`
  (503), sin datos ni detalle. Caché en memoria de 5 minutos **por instancia** (cada
  instancia consulta a Supabase como máximo una vez cada 5 minutos, aunque la llamen mil
  veces) y espera máxima de 8 s. **Límite conocido:** el 503 también queda guardado 5
  minutos, así que un monitor tarda hasta 5 minutos en ver que se recuperó.
- **Entradas malas** (todas respondieron con mensajes en castellano, sin 500): JSON roto,
  ids inválidos, textos de 3000 y 5000 caracteres, montos negativos, texto y de 10^11 y 10^12,
  día 32, fechas imposibles, método de pago inventado, proveedor de 500 caracteres,
  comprobante falso y de 6 MB, profe inválido, dictado sin profe, tarifa negativa,
  `sep` raro en la copia (se ignora), parámetro de 5000 caracteres en panorama.
- **Pagos al equipo**: monto, tipo de gasto y persona no se pueden editar (409); solo
  fecha, método, proveedor, descripción y comprobante. Un encuentro pagado no se edita ni se
  borra (409/400).
- **RLS con la clave pública** (`curl`): 0 filas en jugadores, alumnos, pagos, tipos de
  gasto, equipo, errores, administradores, recordatorios, vistas y el bucket de
  comprobantes; `liquidar_modulo` → "permission denied"; solo `ping` responde.
- **La copia** (`/api/copia`): contra la base real con certificación TEST: los 13 CSV y
  `datos.json` traen exactamente las filas de la base (10 módulos, 45 clases, 20 sesiones,
  5 pagos…); `comprobantes.csv` lista el archivo; no aparecen `app_admins`,
  `emails_permitidos`, `errores_app`, contraseñas ni tokens; falla sin entregar nada si un
  conteo no coincide o si todo viene vacío (probado contra Supabase real). **Tamaño** (en
  memoria, con UUID al azar, que comprimen mal): 38.405 filas (400 clientes × 60 cuotas, 5
  certificaciones de 100 alumnos, 8.000 pagos) → zip de **3,1 MB** y 5,6 s de armado; la
  pantalla avisa si pasa de 5 MB. Un año de uso real da muy por debajo de 1 MB.
- **Coherencia de números**: Por cobrar del Inicio (US$ 14.799, 5 personas) = Cobros
  (jugadores 14.000 + alumno 799); Gastado del mes (US$ 300) = suma de los 5 pagos al equipo
  de Pagos de gastos; la copia y la base coinciden fila por fila; el gasto "Pagué" de
  Mantenimiento hizo bajar "gastos por pagar" de US$ 100 a 0. Diferencia explicada: H11.
- **Doble clic y concurrencia**: pagar módulo (3 en paralelo → 1 pago), cuota del mismo mes
  (3 en paralelo → 1 fila, upsert), copia (triple clic → 1 descarga), "pagar lo atrasado"
  dos veces → la segunda no crea nada. Ver H13 y H14.

## Parte 3. Restauración

Leídos `scripts/restaurar-sql.js`, `docs/RESTAURAR.md` y `docs/ejemplo-copia/restaurar.sql`
y **ejecutados contra Postgres en memoria (PGlite)** con las 12 migraciones reales
(`scripts/verificar-restauracion.mjs`):

- Orden: equipo, certificaciones, módulos, jugadores, alumnos, cuotas de jugadores, cuotas
  de alumnos, tipos de gasto (padres primero), pagos, clases, inscripciones, sesiones,
  recordatorios: respeta todas las claves foráneas (la carga terminó sin errores).
- Apaga los automatismos de usuario de certificaciones, módulos, clases, inscripciones y
  sesiones antes de cargar y los vuelve a prender: al final los **7 están activos** (los 7
  son `crear_modulos`, `crear_encuentros`, `crear_sesiones`, `cambiar_coach`,
  `validar_encuentro`, `proteger_encuentro_pagado` y `proteger_sesion_pagada`). Sin
  apagarlos la carga falla ("módulos duplicados"): control negativo hecho.
- Vacía los 14 tipos de gasto de ejemplo antes de cargar los de la copia.
- Todo en una transacción (un `BEGIN` y un `COMMIT` al final): con un error forzado a
  mitad de camino no queda nada cargado. Control final de conteos dentro del propio SQL.
- Escape: comillas, tildes, saltos de línea, nulos, booleanos y números; **ida y vuelta**:
  datos con 40 clases y 30 sesiones generadas por los automatismos, un pago al equipo
  enlazado y textos con comillas y saltos de línea → las 13 tablas quedan **idénticas fila
  por fila**.
- `RESTAURAR.md` ahora explica cómo recrear usuarios (mail permitido, usuario en el panel,
  alta en `app_admins`) con el SQL exacto.
- **No cubierto**: un proyecto real de Supabase (permisos del editor SQL, roles reales,
  almacenamiento de archivos). Los comprobantes no vienen en la copia (se avisa).

## Parte 4. Experiencia de uso

- **Palabras prohibidas**: test `lib/vocabulario.test.js` (código) y recorrido de la demo
  con 4 CSV exportados, el zip de la copia, todas las pantallas, paneles, ventanas, la ayuda
  y el modo ver como tabla: **0 hallazgos**. Las palabras que quedan están en nombres
  internos (tablas y columnas de `datos.json`, funciones de la base) y en los mensajes de la
  base, que la API traduce (`lib/mensajesApi.js`). Los mensajes de la base con "liquidado" /
  "liquidar" / "categorías" se traducen los 3.
- **¿El Inicio abruma?** Sí, para una persona sin conocimientos técnicos. Hay cinco
  indicadores, un gráfico de ingresos y gastos, "Para hacer", tres gráficos de reparto
  (estado de cobros, gastos por tipo, cobros por método), certificación, quién debe,
  próximos 30 días, proyección y últimos movimientos: unos 14 bloques. Lo que la administradora usa a
  diario son 4: la frase de arriba, los tres botones, "Para hacer" y "Quién debe".
  **Propuesta (sin implementar):** dos vistas. *Hoy* (por defecto): frase, tres botones,
  Para hacer, Quién debe y tres números (cobrado, por cobrar, resultado). *Análisis* (una
  pestaña o botón "Ver más gráficos"): todo lo demás, con el selector de período. Es solo
  cambiar qué se muestra; los componentes y datos ya existen.
- **Base casi vacía** (se simularon respuestas vacías): el Inicio no se rompe; muestra "Todavía
  no hay cobros ni gastos registrados", "Primeros pasos" y "Nada para hacer". Rarezas: H12.
- **Cliente de monto extremo**: ver H6. El resto de la pantalla no se deforma.
- **Clics** (los máximos "ya definidos" **no están escritos** en la documentación del
  proyecto; si hay un criterio, pasámelo y lo comparo). Medido en la demo, sin contar entrar
  a la pantalla: cobrar desde la fila de Cobros **3** (Cobré, método, Registrar cobro);
  cobrar desde Inicio: 1 + elegir la persona + método + Registrar (**4–5**); pagar un gasto
  con monto típico: **1** ("Pagué") y con "Registrar pago": 3 más monto; marcar clase dictada:
  **2** (elegir profe, marcar Dada); marcar sesión: **1**; pagar al equipo: **3**; crear un
  recordatorio: **3** + el texto; agregar un cliente: **2** + nombre y monto.
- **Celular (390 px)**: barra inferior presente en todas las pantallas probadas (Inicio,
  Cobros, Alumnos, Gastos, Pagos, Tipos de gasto, Certificación, planilla de módulo,
  Recordatorios, Configuración, Ayuda, Errores) con la app real y datos reales; **ninguna
  tiene scroll horizontal** (la tabla de `/errores` se desplaza dentro de su tarjeta). Las
  hojas y la barra se probaron en la tanda anterior.
- **Teclado y foco**: los 40 primeros Tab de Inicio muestran indicador de foco; las barras
  del gráfico son enfocables y dicen sus cifras; "Ver como tabla" trae una tabla con
  encabezados y título; los modales atrapan el foco; el panel lateral lo recibía mal (H3,
  arreglado). "Para hacer" se alcanza con Tab y se desplaza con flechas y Re Pág/Av Pág.

## Parte 5. Certificación y gastos con datos TEST

Hecho con la certificación "TEST Cert Final": pagar al equipo (módulo 1: 3 pagos, US$ 245),
pagar lo atrasado (módulo 2 abierto: 2 pagos, US$ 55), segunda vez (no crea nada), pagar dos
veces el mismo módulo (409), cambiar de coach (mantiene lo pagado), editar un pago del equipo
(solo método, fecha, proveedor, descripción; el monto y el tipo dan 409), subir un
comprobante PNG (y ver su enlace firmado de 60 s), "Pagué" (Mantenimiento, con monto típico)
y "Registrar pago" (Wifi, sin monto típico) por la API, y el Inicio sin datos.
**No recorrí con clics en la pantalla** los modales de pagar al equipo (sí en la demo:
"Pagar al equipo" y "Pagar lo atrasado" se abren con fecha y método) ni el flujo de subir
comprobante desde el formulario: se probaron las rutas que usan.

## Parte 6. Publicación

- **Compilación desde un clon limpio** (`git clone` + `npm ci`) con solo las dos variables
  públicas del `netlify.toml`: compila sin avisos; la carpeta `netlify/functions` y
  `/api/salud` no interfieren; `/jugadores` y `/alumnos` siguen redirigiendo.
- **Tests**: 462 pasan. **Lint**: sin avisos. **`npm audit`**: 6 avisos (1 crítico, 5 altos);
  3 en lo publicado (H4) y 3 en herramientas de desarrollo (`glob` y compañía).
- **Encabezados** (clon, `next start`): `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`; `/api/*` con
  `Cache-Control: private, no-store`; los archivos de `_next/static` con caché larga e
  inmutable; las pantallas, caché de CDN del armazón (sin datos). Sin `X-Powered-By`. Falta
  (H16) una CSP completa. **No pude ver los encabezados en Netlify** (el deploy es tuyo).

### Checklist de publicación

1. `git status` limpio y las últimas pruebas en verde (`npm test`, `npm run lint`, `npm run build`).
2. **Borrar los datos TEST** (lista abajo) **antes** de entregar: uno de ellos ensucia el Inicio.
3. Deploy en Netlify (con `netlify.toml`; la carpeta `netlify/functions` se toma sola).
4. Abrir `https://TU-SITIO/api/salud` → `{"ok":true}`.
5. En Netlify › Functions comprobar que `mantener-activo` figura como programada y, al día
   siguiente, su línea en el log (`docs/MANTENER-ACTIVO.md`).
6. Mirar los encabezados de `/api/*` en la URL publicada.
7. Entrar con la cuenta de la administradora; ver el saludo, el Inicio y bajar una copia.
8. Probar "Olvidé mi contraseña" con un mail real (y que el enlace vuelva al sitio).
9. Configurar un monitor externo (UptimeRobot o similar) sobre `/api/salud`.
10. Crear un recordatorio de bajar una copia una vez por mes.

### Tareas que dependen del dueño

- **Plan de Supabase**: gratis se pausa y no tiene copias; decidir si pasar a Pro (copias
  diarias) o bajar la copia a mano cada mes.
- **Copias**: guardar los `.zip` fuera de la compu (Drive, pendrive) y los comprobantes
  aparte (no vienen en el zip). Hacer una restauración de práctica una vez.
- **Contraseñas filtradas**: activar "Leaked password protection" (Supabase › Authentication › Passwords).
- **URL del sitio** en Authentication › URL Configuration (sin esto "Olvidé mi contraseña"
  no vuelve al sitio) y **correo propio (SMTP)** si se usa seguido (H9).
- **Montos reales**: de Wifi, Celulares y Zoom (hoy sin monto); las tarifas de la
  certificación; y revisar la fecha de la cuota de "Fernando G" (H11).
- **Día de cobro del mantenimiento** (hoy "Mantenimiento" tiene monto US$ 100 pero **no tiene
  día de vencimiento**, por eso nunca figura como vencido) y si "del 1 al 10" era un rango.
- **Decisiones**: Inicio liviano (Parte 4), prácticas finales automáticas, relojes en el
  celular, actualización de Next.

## Filas TEST creadas (no se borraron)

Orden sugerido para borrar: primero los pagos (el disparador que protege lo pagado impide
borrar en cascada), después la certificación, el equipo, los alumnos y los jugadores; el
archivo del comprobante aparte.

| Tabla | Nombre | id |
|---|---|---|
| equipo | TEST Profe A | 62a6b0d5-90f6-4b17-8812-7c80164cac26 |
| equipo | TEST Profe B | 36e7e946-c156-4565-973b-6e9aeeeb5578 |
| equipo | TEST Coach X | b0e07405-7c33-4105-8660-79dccb6d986d |
| equipo | TEST Coach Y | 9c56d0c2-d442-4b22-881d-0d3f1d38e4d0 |
| certificaciones | TEST Cert Final (con sus 10 módulos, 45 clases y 20 sesiones, creados solos) | a35a1681-c4be-4750-acea-c0570e827dd1 |
| inscripciones | TEST Alumno Uno en TEST Cert Final | 1c235dce-45cb-45f7-b5bc-955f652ebeae |
| inscripciones | TEST Alumno Dos en TEST Cert Final | 238097cf-f564-4372-9c8d-116535fc19ed |
| alumnos | TEST Alumno Uno | a106af6c-6dc7-4f1d-a4b1-6fe9caff3838 |
| alumnos | TEST Alumno Dos | 8670f64a-4a4e-4cfb-9618-637ad2523eb0 |
| cuotas_alumnos | TEST Alumno Uno, septiembre 2026 | 170da4e9-8f8c-4468-bef0-948edcbaf097 |
| cuotas_alumnos | TEST Alumno Uno, octubre 2026 | 4f0f6150-4652-4b19-baf5-f3623fbe97ca |
| jugadores | TEST Jugador Uno | ac5eae64-247e-4d2d-ae6f-0b4354957b24 |
| jugadores | TEST Jugador Extremo (US$ 900.000: deforma el gráfico del Inicio) | fbe6478f-3361-47ce-ae8c-494d1ccbfda6 |
| cuotas_jugadores | TEST Jugador Uno, octubre 2026 | ed05874e-a985-48d8-b224-9ce342352299 |
| cuotas_jugadores | TEST Jugador Uno, **enero 2031** (la que la API ya no aceptaría) | 9f7a7d8d-5a86-4c59-9a4e-6bf0c62376c2 |
| cuotas_jugadores | TEST Jugador Extremo, octubre 2026 | 174d4638-db44-4b25-b72e-4e1d72cf1d01 |
| pagos_gasto | TEST Cert Final · Módulo 1 · 2 sesiones (US$ 60) | 2e1e40a9-f7e1-4dfe-9990-abbf863ac2e9 |
| pagos_gasto | "TEST descripcion", pago al equipo del módulo 1 (US$ 70, con comprobante) | 2f6b467d-4f8b-403b-ba99-194c85bed0c5 |
| pagos_gasto | TEST Cert Final · Módulo 1 · 2 encuentros (US$ 115) | 79eef780-d00b-494b-9042-d5cda6677269 |
| pagos_gasto | TEST Cert Final · Pagos atrasados · 1 encuentro (US$ 35) | 9a1cc92c-e6ac-4237-a3aa-d11cccc91e30 |
| pagos_gasto | TEST Cert Final · Pagos atrasados · 1 sesión (US$ 20) | 2c6e77a9-4f2d-4258-876d-d9f41e61395c |
| pagos_gasto | TEST Pagué mantenimiento (US$ 100, en Mantenimiento) | c9e6f434-36ab-4081-84af-6906cf7b2f90 |
| pagos_gasto | TEST Registrar pago wifi (US$ 45, en Wifi) | cacb96f5-bc13-4ec5-8195-d09867fe9b51 |
| storage (bucket comprobantes) | archivo del pago `2f6b467d…` | `2f6b467d-4f8b-403b-ba99-194c85bed0c5/1791253510859.png` |
| errores_app | "e is not iterable" (2026-10-06 02:45 UTC) | (por fecha) |

También quedaron 8 sesiones de TEST Alumno Dos marcadas como realizadas sin pagar
(US$ 160 pendientes para TEST Coach X) y varias clases dictadas: están dentro de la
certificación TEST.
