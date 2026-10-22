# Documentación técnica · Sistema de gestión de cobros y gastos

Sistema para que una consultora de coaching deportivo controle las cuotas mensuales de sus dos
grupos de clientes — **Jugadores** (clientes coacheados) y **Alumnos de la
certificación** — y no se le pase nada: quién pagó, quién debe, y qué tiene
pendiente hacer (cobrar, hacer seguimiento). El sistema **no le escribe a los
clientes**: solo le recuerda cosas a quien lo usa.

El historial detallado de cómo se construyó, pasada por pasada, está en
[`docs/desarrollo/HISTORIAL.md`](../docs/desarrollo/HISTORIAL.md). Este archivo es el estado actual.


## Tanda final (2026-10-06)

- **Inicio en dos vistas** (Hoy y Análisis) con un límite de error por bloque: si uno falla, el resto sigue y ese muestra «Reintentar». Valores por defecto seguros en `lib/inicioDatos.js`.
- **Mis gastos** (`/gastos/mis-gastos`; `/gastos/categorias` sigue funcionando): árbol de gastos armado a mano. «¿Se repite?» decide todo el cálculo; la carpeta solo ordena. Los tipos con clave (Pago de sesiones y Pago de encuentros) son automáticos.
- **Gastos por tipo** agrupa por la carpeta que contiene el tipo (regla en `lib/panorama.js`, `gastosPorGrupo`).
- **Relojes** de cuatro ciudades, **Imprimir** en Certificación y **barras cortadas** ante valores extremos.
- La base tiene el automatismo `proteger_categorias` (migración `proteger_tipos_de_gasto`): la restauración (`scripts/restaurar-sql.js`) lo apaga durante la carga. Ver `docs/RESTAURAR.md`.
- Máximos de clics por tarea: `docs/desarrollo/CRITERIOS-DE-USO.md`. Avance y puntos de corte: `docs/desarrollo/TANDA-FINAL.md`.

## Qué es

- **Next.js 14** (App Router) + **Supabase** (Postgres + Auth con RLS).
- Un solo usuario real (la clienta), logueado con email/contraseña.
- Dos tablas de personas (`jugadores`, `alumnos`) con su propio monto
  mensual, día de vencimiento y contacto; cada una con su tabla de cuotas
  mes a mes (`cuotas_jugadores`, `cuotas_alumnos`).
- Un módulo de **Recordatorios** para tareas sueltas del negocio (cobrar,
  hacer seguimiento) con sugerencias calculadas a partir de los datos reales y vista completa
  en `/recordatorios`. El contador de urgentes está en la barra lateral y lo
  vencido o de hoy aparece en "Para hacer hoy" de Inicio.
- Relojes (Argentina, Miami, Paraguay, México) en una línea dentro de la
  barra superior, con `Intl.DateTimeFormat`.
- Inicio con resultado del mes (cobrado menos gastado), gráfico de 6 meses,
  tarjetas de por cobrar, gastos por pagar y certificación, y la lista "Para
  hacer hoy" con acción directa en cada fila.
- **Gastos**: árbol de categorías editable (hasta 3 niveles) en la barra
  lateral, con una página por categoría (historial, totales del mes y del año,
  y para las mensuales y anuales el estado del período: pagado, pendiente o
  vencido), registro de pagos con comprobante opcional y administración de las
  categorías. Ver "Gastos" más abajo.
- **Certificación y equipo de coaches**: certificaciones de 10 módulos con sus
  encuentros, sesiones de coaching por alumno, equipo de profes y coaches, y la
  liquidación de lo que se les paga al cerrar cada módulo (y de lo que se hace
  tarde). Ver "Certificación" más abajo.
- `/demo`: recorrido público sin login con datos inventados, para mostrar el
  sistema sin tocar la base real (ver decisión abajo).
- Registro propio de errores (`errores_app`) con un error boundary de React.

## Cómo correrlo local

```bash
npm ci            # instala según package-lock.json (Node 20 o más; en Netlify se usa 24)
cp .env.local.example .env.local   # completar con las credenciales reales de Supabase
npm run dev
```
Abrí http://localhost:3000 (te pide login).

```bash
npm test     # corre la suite de Vitest (lógica de fechas, deuda, validaciones)
npm run lint    # ESLint con la config de Next (next/core-web-vitals: reglas de hooks, a11y, Next)
npm run build   # build de producción (corre el lint también y falla si hay errores)
npm start       # sirve lo compilado (después de npm run build)
```
Verificación de la restauración de la copia (usa una base en memoria, no toca la real):
`npm install --no-save @electric-sql/pglite && node scripts/verificar-restauracion.mjs`.
Las claves del navegador y la detección de `/demo` están en `lib/navegador.js`;
las etiquetas de método de pago, en `lib/metodoPago.js`.

## Arquitectura

```
app/
  page.js              Dashboard ("¿cómo estoy parada este mes?"), reusado por /demo
  cobros/page.js        Cobros: pestañas Jugadores | Alumnos, components/CobrosPagina.js
                        (/jugadores y /alumnos redirigen acá desde next.config.mjs)
  recordatorios/page.js Vista completa de recordatorios, reusada por /demo
  gastos/[[...ruta]]/page.js  /gastos, /gastos/categorias y /gastos/<id>: todo sale de components/GastosRutas.js
  certificacion/[[...ruta]]/page.js  /certificacion, /modulos[/<id>], /alumnos[/<id>], /equipo[/<id>]: components/certificacion/CertificacionRutas.js
  demo/page.js           Recorrido público sin login, datos en memoria (ver decisión abajo)
  demo/layout.js          Título de pestaña propio, bien distinto del real
  errores/page.js       Registro de errores (discreta, no está en el sidebar)
  error.js, global-error.js   Error boundaries de Next
  template.js           Entrada de página (una sola, 450 ms)
  globals.css           Sistema visual completo: tokens (colores, tiempos) en :root y todos los estilos
  api/
    jugadores, alumnos          Envoltorios finos sobre lib/rutasPersonas.js (misma implementación)
    recordatorios                CRUD de recordatorios
    panorama                     Solo lectura: las vistas cobros_mensuales y gastos_mensuales_por_tipo (12 meses) y los pagos del año, para los gráficos del panel de Inicio
    resumen                      Solo lectura: serie de 6 meses, cobrado del año, gastos por pagar, gastos por hacer, próximos 7 días y últimos movimientos para Inicio
    categorias-gasto, categorias-gasto/[id]   Árbol de categorías: listar (con avisos de vencimiento), crear, editar, desactivar, borrar
    pagos-gasto, pagos-gasto/[id]             Historial y totales, registrar, editar y eliminar pagos
    pagos-gasto/[id]/comprobante              Subir (multipart), ver (URL firmada de 60 s) y quitar el comprobante
    certificaciones[/[id]]                    Listar, crear, resumen (estado_modulos, progreso, calcular_pendientes) y editar
    certificaciones/[id]/liquidar-pendientes  RPC liquidar_pendientes
    certificaciones/[id]/liquidaciones        Pagos al equipo de la certificación (CSV)
    modulos/[id], modulos/[id]/encuentros, modulos/[id]/liquidar   Planilla (calcular_liquidacion), agregar práctica final, RPC liquidar_modulo
    encuentros/[id], sesiones/[id]            Editar (y quitar una práctica final)
    inscripciones[/[id]]                      Inscribir, ficha del alumno y cambiar coach
    equipo[/[id]]                             Alta, ficha (cobrado, pendiente, liquidaciones), edición, desactivar y borrar sin historial
    errores                      alta/lectura de errores_app

components/
  panel/                Gráficos SVG propios del Inicio (barras agrupadas, anillo, mini línea, histograma) y sus tarjetas
  CobrosPagina.js       Lista de solo lectura de Jugadores y Alumnos (compartida, ver decisión abajo)
  PanelCliente.js       Panel lateral con todo lo editable de un cliente (hoja inferior en el celular)
  PanelLateral.js       Contenedor del panel (foco atrapado, Escape, clic afuera)
  ClienteModal.js       Alta/edición de jugador o alumno
  RecordatorioForm.js, PersonaSelect.js   Formulario de recordatorios (vista completa)
  Shell.js               Estructura común: barra lateral + barra superior + contenido (app real y /demo)
  Sidebar.js             Barra lateral única, secciones desplegables de hasta 3 niveles, cajón en el celular
  Topbar.js              Barra superior con vidrio: título, buscador, relojes y "+ Nuevo"
  AccionesProvider.js    Mes elegido, atajos de teclado y las ventanas globales (cobro, cliente, recordatorio, buscador)
  RegistrarCobroModal.js Registrar un cobro eligiendo efectivo o transferencia
  PagoGastoModal.js      Registrar o editar el pago de un gasto, con comprobante opcional (atajo G)
  GastosPagina.js        Página de una categoría (o de todos los pagos): totales, estado del período e historial
  CategoriasAdmin.js, CategoriaModal.js   Administrar el árbol de categorías
  GastosRutas.js         Elige la página de Gastos según la ruta (sirve en la app y en /demo)
  certificacion/         Pantalla única (CertificacionPagina), pestañas Módulos/Alumnos/Equipo, planilla del módulo, paneles y ventana "Pagar al equipo"
  MarcarSesionModal.js   Marcar una sesión realizada (atajo S)
  Paleta.js              Buscador de personas y secciones (Ctrl+K / Cmd+K)
  WorldClock.js          Los cuatro relojes en una línea
  MonthSelect.js         Selector de mes con menú de vidrio
  Ventana.js, Avatar.js, Enlace.js   Ventana modal, avatar con iniciales, enlace que sirve en la app y en /demo
  AuthGate.js            Login + armado de la app, deja pasar /demo y /reset-password sin sesión
  Toast.js               Aviso con "Deshacer" tras cambios de estado y bajas
  Esqueleto.js           Bloques de carga con la forma del contenido real
  Iconos.js              Íconos SVG (reemplazan a los emojis)

lib/
  rutasPersonas.js       Rutas API de jugadores y alumnos (una sola implementación)
  resumen.js             Cálculos de Inicio: gastos por pagar, certificación, pendientes de hoy (testeada)
  navegacion.js          Árbol de la barra lateral: lo fijo (NAV) y la sección Gastos armada con las categorías (testeada)
  gastos.js              Árbol, períodos, vencimientos y "gastos por hacer" (testeada)
  gastosValidacion.js    Validación de categorías, pagos y comprobantes, la misma en servidor y formularios (testeada)
  gastosServidor.js      Columnas, mensajes y formas compartidas por las rutas de gastos
  gastosDemo.js          Categorías y pagos en memoria para /demo, con las mismas reglas (testeada)
  GastosContext.js       Categorías y avisos de toda la app (barra lateral, título, buscador)
  abrirComprobante.js    Abre el comprobante en otra pestaña con la URL firmada
  certificacion.js       Liquidación, pendientes, estado de módulos y avance en JavaScript: la misma lógica que la base (testeada con el caso de referencia)
  certificacionValidacion.js  Validación de certificaciones, equipo, encuentros, sesiones y liquidaciones, y errores intencionales de la base (testeada)
  certificacionResumen.js     Lo de la certificación para Inicio y "Para hacer hoy" (testeada)
  certificacionServidor.js    Columnas y mensajes compartidos por las rutas de la certificación
  certificacionDemo.js        Certificación de ejemplo en memoria para /demo (testeada)
  CertificacionContext.js     Certificación elegida y su resumen, para las pantallas, el buscador y "Marcar sesión"
  certificacionPagina.js      Lógica pura de la pantalla única: pestañas, estado de la tira, textos de los avisos, rol y deuda (testeada)
  mensajesApi.js              Mapa de mensajes de la base a traducir en la API (testeada)
  useRegistrarClase.js        "Registré una clase o sesión": lleva al módulo en curso
  vocabulario.test.js         Falla si vuelve una palabra prohibida a los textos de la app
  contraste.js           Contraste WCAG; contraste.test.js lee los tokens de globals.css y exige AA
  NavContext.js, AccionesContext.js, useMenu.js   Navegación (router o /demo), mes y acciones globales, menús
  validacion.js          Validación de forma del backend (uuid, fechas, meses, límites)
  respuestasApi.js       Errores de base traducidos a castellano; los inesperados van a errores_app
  fechas.js              Toda la aritmética de fechas en hora Argentina (ver decisión abajo)
  horasMundiales.js       Hora de las 4 ciudades del reloj mundial (testeada)
  bienvenida.js           Saludo al iniciar sesión: email → nombre y saludo por hora (testeada)
  moneda.js               Formato US$ de todos los montos (testeada)
  deuda.js               Cálculo de "meses adeudados"
  historialCuotas.js     Historial completo de cuotas de una tabla, paginado
  camposCliente.js       Validación compartida de jugador/alumno (server + cliente)
  recordatorios.js       Validación de recordatorios (testeada)
  recordatoriosAgrupar.js Agrupado Vencidos/Hoy/Próximos/Hechos (panel + vista completa)
  RecordatoriosContext.js Estado único de recordatorios, compartido por panel y vista completa
  usePersonasActivas.js  Jugadores/alumnos activos para sugerencias y PersonaSelect
  dataProvider.js         Capa de datos intercambiable: dataProviderReal detrás de un Context
  dataProviderDemo.js     Misma interfaz, en memoria — la usa /demo
  demoData.js             Genera los datos de ejemplo de /demo (testeada)
  apiAuth.js              Corta con 401 si no hay sesión válida
  registrarErrorServidor.js, registrarErrorFrontend.js   Registro en errores_app
  useFocusTrap.js         Atrapa el foco de teclado dentro de un modal o cajón

supabase/migrations/      Esquema completo versionado, en orden (ya aplicado en Supabase)
app/fonts/                Fraunces e Inter en woff2 (el build no descarga nada)
docs/                     Informe de Next 16 y capturas antes/después del rediseño
```

## Diseño y navegación

La referencia aprobada es `docs/referencia-rediseno.html`. Reglas que el código
respeta (están como comentario al inicio de `app/globals.css`):

- **Tokens en un solo lugar** (`:root` de `globals.css`): fondo #0F1A2A, lateral
  #0A1320, tarjetas #152237, texto #ECE5D7 (nunca blanco), secundario
  #97A0AE, dorado #B8893E / #D9B66F, positivo #8FD1AE, alerta #E8A374.
- **Dorado** solo en botón principal, ítem activo, resultado del mes e
  ingresos del gráfico (más el contador de la barra lateral, como en la
  referencia). **Vidrio** solo en lo que flota. **Serif** solo en títulos de
  página y saludo; los números van en Inter con cifras tabulares.
- **Escala** (tokens `--t-*`, `--pad-card`, `--gap` y `--ancho-*` en `:root`): texto
  base 15 px, menú lateral 14,5 px con ítems de 40 px y barra de 248 px,
  etiquetas 13 px, cifras de tarjetas 28 px, resultado del mes 52 px, saludo
  34 px, títulos 22 px, tarjetas con 26 px de padding y separaciones de 20 px.
  En el celular se achican algunos (cifra 24, resultado 40, saludo 28). El
  contenido se estira hasta 1680 px.
- **Inicio** (grilla fluida): fila 1 resultado del mes y gráfico (220 px, con
  el monto al pasar el mouse); fila 2 Por cobrar, Gastos por pagar,
  Certificación y Cobrado en el año (por fecha de pago); fila 3 "Para hacer
  hoy" y, a la derecha, "Próximos 7 días" y "Últimos movimientos". Esa columna
  scrollea con la página y baja debajo de "Para hacer hoy" por debajo de 1200 px.
  "Próximos 7 días" es de mañana en adelante (lo de hoy ya está en "Para hacer
  hoy"): cuotas según `dia_vencimiento` de cada cliente (si no están pagadas),
  gastos fijos según su vencimiento (ver "Gastos") y recordatorios.
- **Tiempos**: entrada de página 450 ms (sube 6 px), menús 180 ms,
  despliegues 280 ms, hovers 150 ms. Nada se mueve solo (sin fondo animado,
  sin conteo de números, sin esqueletos que brillan). Todo se apaga con
  `prefers-reduced-motion`.
- **Contraste AA medido**: `lib/contraste.test.js` calcula la relación de cada
  par de colores desde los tokens y falla si baja de 4,5:1.
- **Barra lateral**: se arma desde `lib/navegacion.js`. Un nodo con `hijos` es
  un desplegable (hasta 3 niveles); lo abierto se recuerda en `localStorage`
  y el que contiene la página actual se abre solo. La sección Gastos sale de la
  base (`armarNav`): un grupo es un enlace a su página y además se despliega
  con la flecha. (Desde la Fase 2 de la simplificación el menú de
  cinco entradas ya no lleva el punto de vencimiento: está en cada tarjeta de
  Gastos y en el Inicio. El punto es dorado si algo vence en los próximos 7 días
  y ámbar si ya venció.)
- **Panel de Inicio** (Tanda 5): indicadores con tendencia y variación, gráfico
  de ingresos y gastos, repartos, quién debe, próximos 30 días y proyección, todo
  de solo lectura y con SVG propio. Las cuentas están en `lib/panorama.js` (con
  tests); los datos, en `/api/panorama` y `/api/resumen`. Qué muestra cada bloque
  y de dónde sale cada número: `docs/desarrollo/INICIO.md`.
- **Atajos**: C (cobro), G (pago de gasto), S (sesión realizada), N (cliente nuevo), R (recordatorio)
  fuera de los campos de texto y sin otra ventana abierta; Ctrl+K / Cmd+K busca
  personas, secciones, categorías de gasto (con su camino completo) y, de la
  certificación elegida, el equipo, los alumnos inscriptos y los módulos.
- **Mes elegido**: vive en `AccionesProvider` y se guarda en `sessionStorage`;
  Inicio, Jugadores y Alumnos usan el mismo.
- **Cobrado y gastado de Inicio**: los dos cuentan por **fecha de pago** (es la
  plata que entró o salió ese mes, aunque la cuota sea de otro): una cuota de
  septiembre cobrada el 3 de octubre suma al resultado de octubre. Una cuota
  pagada sin fecha cuenta por su mes. Las tablas de Jugadores y Alumnos siguen
  por mes de la cuota (`lib/resumen.js`, `cobradoPorFechaDePago`). "Gastos por pagar" se calcula de
  `categorias_gasto` siempre sobre el mes real de hoy, no el elegido.
- **Método de pago**: `cuotas_*.metodo_pago` (efectivo o transferencia). Se
  elige al registrar un cobro desde Inicio, se edita en la tabla y sale en el
  CSV. Editar solo el monto o la fecha no lo toca; volver una cuota a
  pendiente lo borra.

## Gastos

Las categorías viven en `categorias_gasto` (árbol editable, hasta 3 niveles) y
los pagos en `pagos_gasto` (en US$). Todo el acceso pasa por las rutas
`/api/categorias-gasto` y `/api/pagos-gasto`, con la sesión del usuario (RLS),
validación en el servidor (`lib/gastosValidacion.js`) y errores en castellano
registrados en `errores_app`.

- **Recurrencia y período.** Una categoría puede ser `ninguna`, `mensual` o
  `anual`. Cada pago de una recurrente cubre un período (`periodo`: primer día
  del mes, o del año en las anuales); en un pago suelto es null. Un pago cuenta
  para el período que dice, o para el de su fecha de pago si no lo trae.
- **Vencimiento** (`vencimientoDelPeriodo`): el día cargado del mes (el 31 en un
  mes de 30 días vence el 30); **sin día cargado vence a fin de mes**; en las
  anuales, el `mes_vencimiento` del año (Zoom: 31 de julio). "Vencido" desde el
  día siguiente, igual que las cuotas.
- **Períodos anteriores al uso del sistema** (`esAnteriorAlSistema`): un
  vencimiento anterior al día en que se creó la categoría (`created_at`, hora
  Argentina) no cuenta como vencido ni avisa, porque no hay forma de saber si se
  pagó. Vale en Para hacer hoy, Próximos 7 días, el indicador de la barra
  lateral, la tarjeta "Gastos por pagar" y el estado de la página de la
  categoría ("Sin seguimiento"). Un pago de ese período sí lo deja pagado. Zoom
  (anual, julio) avisa recién en julio de 2027. El mismo día de la creación
  todavía cuenta.
- **Para hacer hoy** (`gastosPorHacer`): los gastos fijos sin pagar que ya
  vencieron (posteriores a la creación de la categoría) o que vencen dentro de 7 días, con la acción "Registrar pago" y la
  etiqueta Vencido / Vence hoy / Mañana / En N días. Los que vencen de mañana en
  adelante también están en "Próximos 7 días". Un gasto pendiente que vence
  dentro de más de 7 días no aparece en ninguno (sí en su página y en la tarjeta
  "Gastos por pagar" del mes).
- **Dónde se registran los pagos**: solo en categorías sin subcategorías
  activas. Una categoría con pagos no puede pasar a ser un grupo, y una
  recurrente no puede tener subcategorías (la recurrencia se configura en la
  hoja).
- **Desactivar, no borrar.** Desactivar una categoría desactiva toda su rama
  (si no, sus subcategorías seguirían apareciendo en los pendientes); el
  historial se conserva. Borrar solo se puede sin pagos, sin subcategorías y sin
  `clave`; con pagos el mensaje explica que puede desactivarla. Las dos
  categorías con `clave` (`pago_sesiones`, `pago_encuentros`, que usa la
  liquidación de coaches) se pueden renombrar, no desactivar ni borrar. Las
  categorías no se mueven de padre.
- **Pagos de una liquidación** (con `equipo_id` o `modulo_id`): llevan la
  etiqueta "Liquidación". Se puede corregir la fecha, el método, el proveedor,
  la descripción y el comprobante; el monto, la categoría y la persona los
  define la liquidación y el servidor rechaza cambiarlos
  (`validarEdicionPagoLiquidacion`). Si están mal, se elimina el pago (lo que
  pagaba vuelve a quedar pendiente) y se vuelve a liquidar.
- **Comprobantes**: bucket privado `comprobantes` (JPG, PNG, WebP o PDF, hasta
  5 MB). El navegador valida tipo y tamaño antes de subir; el servidor repite
  la validación y además mira los primeros bytes (el tipo declarado se puede
  falsear). El archivo se guarda en `<id del pago>/<marca de tiempo>.<ext>`. Se
  ve con una URL firmada de 60 segundos; el bucket nunca es público. Si el pago
  se guarda pero el comprobante falla, el pago queda y se avisa para reintentar
  desde Editar. Al eliminar un pago se borra también el archivo (si el archivo
  no se pudiera borrar, queda anotado en `errores_app`).
- **Exportar**: cada página de gastos tiene Imprimir y Exportar CSV, con la ruta
  completa de la categoría, el período, proveedor, método, monto y si tiene
  comprobante. `/gastos/pagos` ("Todos los pagos") exporta todos los gastos.
- **/demo** tiene su propio árbol y pagos de ejemplo en memoria
  (`lib/gastosDemo.js`) con las mismas reglas de validación; no llama a la base.

## Certificación

La base (migraciones `fase2_certificaciones_coaches_liquidacion`,
`liquidacion_singular_plural` y `fase3_proteccion_pagados_pendientes_estado_modulos`)
hace el trabajo pesado: crea los 10 módulos y sus 4 encuentros al crear una
certificación, las 10 sesiones al inscribir, pasa al nuevo coach solo las
sesiones no hechas y no pagadas, valida las prácticas finales, calcula
(`calcular_liquidacion`, `calcular_pendientes`) y liquida en una transacción
(`liquidar_modulo`, `liquidar_pendientes`). La app no cambia tablas, funciones
ni políticas: las usa con la sesión del usuario.

- **Una sola pantalla** (`/certificacion`, `components/certificacion/CertificacionPagina.js`):
  cabecera con selector (se recuerda) y *Configurar* (tarifas y datos, nueva
  certificación, exportar los pagos al equipo a Excel), la **tira de los 10
  módulos** con su estado (`estado_modulos`: Pagado, Listo para pagar, En curso,
  Sin empezar) y las pestañas *Módulos* (avisos "El Módulo N terminó: hay que
  pagar US$ X a P personas" con *Pagar al equipo* y "Pagos atrasados al equipo"
  con *Pagar lo atrasado*, más la lista de módulos), *Alumnos* ("X de 10
  sesiones", coach, "Listo para certificar"; inscribir, cambiar coach y ficha en
  un panel) y *Equipo* (rol, cobrado y lo que se le debe; alta, edición,
  desactivar y borrar en un panel). Tocar un módulo abre su planilla debajo de
  la tira. Las direcciones viejas (`/modulos`, `/alumnos`, `/equipo` y sus
  fichas con id) siguen respondiendo y abren su pestaña. Sin certificación,
  invita a crearla.
- **Errores de la base**: los que lanza a propósito (código `P0001`, como
  "Este módulo ya fue liquidado" o "Las prácticas finales solo pueden estar en
  los módulos 9 y 10") se devuelven en castellano. Los que tienen palabras que la
  app ya no usa se traducen en un solo lugar (`lib/mensajesApi.js`, con tests):
  "ya fue liquidado" sale como "ya fue pagado" y "antes de liquidar" como
  "antes de pagar al equipo"; el resto pasa igual: 409 si algo "ya fue" hecho o se
  llegó al máximo, 400 el resto, 403 "No autorizado"
  (`respuestaDeErrorIntencional`). El resto sigue el patrón de siempre.
- **Lo pagado**: la planilla lo muestra con "Pagado", con los controles
  bloqueados y una nota de cómo corregirlo (eliminar el pago en Gastos). La
  fecha de un encuentro pagado sí se puede cambiar (la base no la protege).
- **Pagar al equipo** (antes "Liquidar"): el botón se habilita cuando el módulo
  está listo (todas sus clases dadas) y no falta ninguna tarifa. La ventana
  muestra el detalle, pide fecha (hoy) y método (obligatorio), avisa que se
  crean los pagos en Gastos y después muestra lo creado con enlaces. Mientras
  procesa no se puede volver a confirmar; la base además impide liquidar dos
  veces.
- **Pagos atrasados**: "Pagar lo atrasado" usa `liquidar_pendientes` y la ventana usa `calcular_pendientes`, que incluye
  todo lo hecho y no pagado (también de módulos abiertos). "Para hacer hoy"
  avisa solo de lo hecho tarde en módulos ya liquidados
  (`pendientesTardios`), porque lo de un módulo abierto se paga al cerrarlo. Lo
  tardío de un módulo anterior también entra al liquidar el siguiente módulo
  (así funciona `calcular_liquidacion`), así que puede figurar en las dos filas
  de "Para hacer hoy" a la vez; se paga una sola vez, por cualquiera de los dos
  caminos.
- **Para hacer hoy**: "Módulo N listo para liquidar: US$ X para P personas"
  (`estado_modulos.listo_para_liquidar` + `calcular_liquidacion`) con "Revisar
  y liquidar", los pagos tardíos y "Listo para certificar" durante los 7 días
  siguientes a la décima sesión de un alumno. Inicio suma a la tarjeta
  "Certificación" el módulo en curso, los alumnos en condiciones y lo pendiente
  de pagar al equipo (primera certificación en curso).
- **Gastos**: los pagos de liquidación (con `equipo_id` o `modulo_id`) se
  marcan "Liquidación"; se les puede corregir fecha, método, proveedor,
  descripción y comprobante, pero no el monto ni la categoría. Al eliminarlos,
  la confirmación explica que lo que pagaban vuelve a quedar pendiente (el
  módulo sigue cerrado) y se paga con "Liquidar pendientes". La planilla de
  liquidaciones encuentra los pagos por los encuentros y sesiones que cubren,
  no por su descripción (que ahora se puede editar).
- **Exportar**: pagos al equipo (Configurar › Exportar los pagos al equipo a
  Excel) y avance de alumnos (Alumnos › ⋯ › Exportar el avance a Excel). Todos
  los CSV (también Cobros y Gastos) usan `;` con coma decimal cuando el navegador
  usa coma decimal (es-AR y similares), `,` en los demás casos, con BOM UTF-8
  (`lib/csv.js`, con tests).
- **/demo**: una certificación de ejemplo en memoria (`lib/certificacionDemo.js`)
  con equipo, cuatro alumnos con distinto avance, los módulos 1 y 2 liquidados,
  el 3 listo para liquidar y una sesión hecha tarde. La liquidación y los
  pendientes se reimplementaron en `lib/certificacion.js` y se testean con el
  caso de referencia verificado en la base (tarifas 50/40/60: coach A 50, profe
  B 80, profe C 140).

## Decisiones de producto (y por qué)

**Desde cuándo cuenta la deuda de una persona** (`lib/deuda.js`): desde
`fecha_inicio` si el alumno la tiene cargada (cuándo arrancó de verdad, un
campo que ya existía pero no se usaba en ningún lado), o si no desde
`created_at` (cuándo se lo cargó en el sistema). Los jugadores no tienen
`fecha_inicio`, así que siempre cuentan desde `created_at`. Un mes cuenta
como "debido" si es anterior al mes actual y no tiene una cuota "pagado", o
si es el mes actual y ya está "atrasado" (mismo criterio que el badge). El
mes actual sin vencer todavía no es deuda, es una cuota pendiente normal.

**Atraso** (`cuotaAtrasada` en `lib/fechas.js`): con `dia_vencimiento`
cargado, "Atrasado" aparece el día *después* del vencimiento (el propio día
todavía está en fecha); un día 31 en un mes de 30 días vence el 30. Los
meses anteriores al actual que sigan pendientes también se marcan atrasados.
Sin `dia_vencimiento`, nunca se marca solo — por eso existe la sugerencia
"antes de fin de mes" en Recordatorios.

**Todas las fechas en hora Argentina, no en la del navegador ni la del
servidor** (`lib/fechas.js`): "hoy", "este mes", "atrasado", el mes por
defecto, el selector de meses y el saludo se calculan con
`Intl.DateTimeFormat` y `timeZone: America/Argentina/Buenos_Aires`. Si la clienta
abre la app de viaje, o el servidor corre en UTC (Netlify), a las 22 h del
día de vencimiento la cuota sigue "en fecha" y el último día del mes no salta
al mes siguiente. Los tests usan instantes con offset explícito, así el
resultado no depende del huso de la máquina; se corren también con `TZ=UTC`
(el huso del servidor). Ojo: en Windows, Node solo respeta `TZ=UTC`; las
corridas que antes se anotaron "en Tokio, Los Ángeles y Kiritimati" en esta
máquina en realidad usaron la hora de Argentina (ver `docs/desarrollo/AUDITORIA.md`).

**El sistema nunca le escribe al cliente** (decisión de producto): no hay
botón "Recordar", ni links a WhatsApp o mail, ni mensajes armados. Solo
recuerda cosas a quien lo usa (panel, contador, sugerencias) y esa persona se
comunica por sus propios medios. Motivo: menos piezas que puedan fallar (el
botón dependía de normalizar teléfonos con código de país, de que WhatsApp
Web abriera bien y de un formato de mensaje). El campo **contacto** es texto
libre y opcional (un teléfono, un mail, una nota; hasta 300 caracteres), sin
validar formato, y se ve bajo el nombre en la tabla y en "Editar cliente"
para tenerlo a mano. Los contactos ya guardados no se tocaron.

**Moneda: todo en dólares** (`lib/moneda.js`): los montos se muestran como
`US$ 1.234` (con centavos solo si existen: `US$ 1.234,50`), en pantalla,
tarjetas animadas, progreso de alumnos, sugerencias, demo, impresión y en los
encabezados del CSV (`Monto (US$)`; los valores del CSV son números crudos,
sin símbolo, para que Excel los sume).

**Monto mensual al agregar un cliente**: la ventana arranca con el campo vacío,
con un ejemplo en gris ("Ej: 150"), y el monto es obligatorio (mayor a 0): no
hay un valor "normal" que sugerir. Lo único que quedó con los valores viejos
es la base: la columna `monto_mensual` de `jugadores` (default 15000) y de
`alumnos` (default 10000), que solo se usaría si alguien insertara sin monto
(la app siempre manda uno). No se tocó el esquema. Los montos inventados de
`/demo` (`lib/demoData.js`) son de ejemplo y están en dólares.

**Fuentes dentro del repo** (`app/fonts`, `next/font/local`): Fraunces e Inter
como `woff2` variables (400–600, subset latin, ~130 KB). Antes venían de
Google Fonts en cada build y el build fallaba a veces
("An error occurred in `next/font`"). Verificado con builds seguidos,
también sin acceso a Google.

**Saludo al iniciar sesión, no fijo en el dashboard**
(`lib/bienvenida.js`, `components/Bienvenida.js`): el inicio ya no dice
"Buenas tardes, la clienta". Al entrar aparece una vez un saludo sobre la app
desenfocada ("Buenos días / Buenas tardes / Buenas noches" según la hora
argentina) con el nombre que corresponda al email de la cuenta, tomado de
`NOMBRES_POR_EMAIL` (para sumar a alguien, agregar una línea ahí). Sin
nombre cargado dice el saludo y "¡Hola de nuevo!" — no se usa la parte del
email antes del @, que suele quedar como "facu1988". Se cierra solo a los
~2,6 s, con un click o con una tecla; no atrapa el click (un click en un link
navega y lo cierra). Solo se dispara al pasar de "sin sesión" a "con sesión"
(no al recargar ya logueado, ni al renovar el token, ni al volver a entrar
tras un vencimiento) y se anota por `session_id` en `sessionStorage`, porque
supabase-js puede re-emitir `SIGNED_IN` al volver a la pestaña. La marca
"Coaching deportivo" (sidebar, login, metadata) no cambia.

**Si la sesión vence, no se pierde lo que se estaba cargando**
(`components/AuthGate.js`): antes, un 401 cambiaba toda la pantalla por el
login y se perdía el modal abierto. Ahora, si la sesión se pierde sin tocar
"Cerrar sesión", la app queda montada e inerte debajo del login (email
precargado, foco en la contraseña, Escape no cierra el modal de atrás). Al
volver a entrar con la misma cuenta todo sigue ahí y alcanza con tocar
Guardar de nuevo; si entra otra cuenta, la app se remonta de cero para no
mostrarle datos ajenos. Recargar la página sí pierde lo no guardado.

**Por qué `CobrosPagina.js` es un solo componente para Jugadores y Alumnos**
(antes `PersonasPage.js`, con tablas de celdas editables; desde la Fase 2 de la
simplificación son filas de solo lectura y el panel lateral concentra la
edición): las dos pantallas eran ~95% el mismo código (cargar cuotas del mes,
editar, dar de baja, exportar, buscar).
Se unificaron en un componente parametrizado por `tipo`, con la única
diferencia real (la columna "Abonado" con barra de progreso) condicionada a
`tipo === "alumno"`. Bajo riesgo: es una parametrización directa, no una
abstracción especulativa para casos que no existen.

**Por qué no hay selección múltiple para marcar varios pagos a la vez**: con
la cantidad de personas que maneja la clienta hoy (decenas, no cientos), marcar
de a uno con un click en el badge ya es rápido, y sumar checkboxes +
toolbar de acción masiva agrega superficie de UI y de bugs (¿qué pasa si
selecciono gente de meses distintos? ¿con montos distintos?) para un ahorro
de tiempo marginal. Si el volumen de personas crece mucho, vale la pena
reconsiderarlo.

**Vista imprimible en vez de generar un PDF**: se usa la impresión nativa
del navegador (`window.print()` + `@media print`) sobre el mismo dato en
pantalla, en vez de sumar una librería de generación de PDF. Cualquier
navegador moderno permite "Guardar como PDF" desde el diálogo de impresión,
así que cubre el mismo caso de uso (comprobante para imprimir o guardar)
sin la complejidad y el peso de una librería.

**Confirmación solo al deshacer un pago**: marcar como "pagado" no pide
confirmación (es la acción normal de todos los días); pasar de "pagado" a
"pendiente" sí, porque implica deshacer un cobro ya registrado. Los cambios
de estado y las bajas además muestran un toast con "Deshacer" por unos
segundos, en vez de un historial completo de auditoría.

**Accesibilidad — contraste medido, no a ojo**: los colores de texto sobre
el vidrio se midieron con la fórmula de contraste WCAG (luminancia relativa)
contra el peor caso real (el extremo más claro del degradé de fondo,
compuesto con `.glass-strong`). `--slate` (el color de texto secundario más
usado) daba 4.24:1 en ese caso — por debajo del mínimo de 4.5:1 para texto
normal — y se ajustó a `#99a6bb` (4.56:1 ahí, bastante más en el resto de
superficies). El resto de los colores (`--ivory`, `--bronze`, `--green`,
`--amber`, `--red`) ya pasaban 4.5:1 en todos los fondos reales de la app.

**Capa de datos intercambiable (`lib/dataProvider.js`)**: en vez de que cada
componente llame a `apiFetch` directo, todos pasan por un Context con una
interfaz común (`listarPersonas`, `guardarCuota`, `crearRecordatorio`, etc.).
El valor por defecto ya es `dataProviderReal` (pega a `/api/...` como
siempre), así que la app real no necesita envolver nada. Solo `/demo`
envuelve su árbol con `dataProviderDemo`, un CRUD en memoria con la misma
interfaz — así reusa los mismos componentes (`CobrosPagina`, `Home`, la
vista de recordatorios) sin copiarlos ni bifurcar su lógica.

**Por qué `/demo` no simula un historial de cuotas mes a mes**: cada persona
tiene una única `cuota_actual` en memoria, y cambiar el selector de mes
sigue mostrando esa misma cuota — no hay una tabla de cuotas históricas por
mes como en la base real. Simular eso completo hubiera significado
reconstruir buena parte del backend solo para la demo, para un beneficio
menor (la demo ya muestra atrasados, vencimientos y progreso variado, que es
lo que importa para mostrar el sistema funcionando).

**Panel de recordatorios y vista completa comparten un único estado**
(`lib/RecordatoriosContext.js`) en vez de cada uno hacer su propio fetch:
así crear, editar o marcar hecho un recordatorio desde cualquiera de los dos
lugares se ve reflejado en el otro sin recargar la página, sin necesidad de
sincronizar manualmente dos copias de la misma lista.

**Acciones optimistas en pagos y recordatorios**: marcar un pago o tildar un
recordatorio se ve al instante, sin esperar al servidor; si el servidor
falla, se vuelve a cargar el estado real y se muestra el error. La
confirmación visual del pago (check que se dibuja + pulso verde) recién se
dispara cuando el servidor dijo que sí, así que nunca "miente". Los cambios
de un mismo recordatorio salen en fila (cola por id en
`RecordatoriosContext`) para que "hecho" y "deshacer" seguidos no puedan
llegar al revés.

**Movimiento con criterio**: fondo que deriva en ciclos de más de un minuto
(solo `transform`, lo mueve la GPU), elevación sutil al pasar el mouse,
transiciones de 0,2-0,4 s. Nada espera a una animación para dejar hacer
algo, y `prefers-reduced-motion` las apaga de verdad (CSS + `MotionConfig`
+ un hook propio para el conteo). Framer Motion se usa solo para la salida
animada de un recordatorio (algo que ya no está en el DOM, que CSS no puede
animar) y en modo liviano (`LazyMotion`): el resto es CSS o
`requestAnimationFrame`. Con Framer completo la primera carga del dashboard
pasaba de 155 kB a 216 kB; así queda en 166 kB.

**Navegación sin recarga (`next/link`)**: el reloj, el sidebar y el panel
quedan montados entre páginas; solo cambia el contenido, con una entrada
corta. Se verificó que no quedan intervalos, listeners ni suscripciones
colgados después de decenas de navegaciones seguidas.

## Acceso a los datos (RLS y registro público)

El esquema completo está en [`supabase/migrations/`](../supabase/migrations)
(17 migraciones, en orden; ya están aplicadas en Supabase, no volver a
aplicarlas; se comprobó que el esquema que producen es idéntico al de la base real,
ver `docs/desarrollo/VERIFICACION-CODIGO.md`). El acceso funciona así:

- Todas las tablas de `public` tienen RLS con una única política, "solo admins":
  `(select private.es_admin())`. Solo puede leer o escribir quien esté
  anotado en `public.app_admins`.
- `private.es_admin()` es una función `SECURITY DEFINER` (con
  `search_path = ''`) en el esquema `private`, que **no está expuesto por la
  API**. Consulta `app_admins` con los permisos del dueño, así la lista de
  admins no se le muestra a nadie. `app_admins` tiene RLS y ninguna política
  a propósito: no se lee ni se escribe desde la API.
- **Por qué existe la función.** La primera versión de esta segunda capa
  (`auth.uid() IN (SELECT user_id FROM app_admins)` directo en cada política)
  bloqueaba a todos, incluso al admin: la subconsulta corría con los permisos
  del usuario, `app_admins` no le dejaba leer ni su propia fila, y la app veía
  todo vacío sin ningún error. Las migraciones `..._fix_rls_es_admin...` y
  `..._mover_es_admin_a_esquema_privado` lo resolvieron.
- **Anotar a otro usuario** (por ejemplo a la administradora, después de crearla en
  Authentication → Users): SQL Editor de Supabase,
  `insert into public.app_admins (user_id, email) select id, email from auth.users where email = '...';`

**Verificado el 2026-09-29 contra la base real** (transacciones con rollback,
simulando el rol `authenticated`): la cuenta anotada pasa `es_admin()` y lee
las tablas; un usuario que no está anotado ve 0 filas y su `insert` falla con
`42501 new row violates row-level security policy`; el admin tampoco ve
`app_admins` desde la API.

**El registro público está bloqueado** (migración
`20260930000255_bloquear_registro_no_permitido`): un trigger `before insert` en
`auth.users` (`private.bloquear_registro_no_permitido()`) rechaza con "Registro
no permitido" cualquier mail que no esté en `private.emails_permitidos`. Cubre
registro público, invitaciones y altas manuales, aunque el interruptor de
registro del panel de Auth siga habilitado. Para sumar a alguien hay que
agregar su mail a esa tabla (SQL Editor) y recién después crear la cuenta.

## Estado de `npm audit`

Revisado el 2026-10-05 en un clon limpio (`npm ci`): **6 avisos (1 crítico, 5
altos)**; solo 3 están en lo que se publica (`npm audit --omit=dev`): `next`
14.2.35 (crítico, un grupo de avisos), `postcss` y `source-map-js` (altos, que
arrastra `next`). Los otros 3 son herramientas de desarrollo (`glob`, etc.). No
hay parche dentro de la rama 14 de Next. Los avisos de `next` son sobre el
optimizador de imágenes (`next/image`), `rewrites`, Server Actions, middleware y
la caché de componentes de servidor: esta app no usa imágenes optimizadas,
rewrites, Server Actions ni middleware. Con esa superficie el riesgo práctico es
bajo, pero conviene planificar la actualización (ver `docs/desarrollo/INFORME-NEXT-16.md` y
`docs/desarrollo/AUDITORIA.md`). La librería nueva `fflate` (copia de seguridad) no suma avisos.

## Deploy en Netlify

La config ya está en el repo: [`netlify.toml`](../netlify.toml) (build
`npm run build`, publish `.next`, Node 24) y el adaptador oficial
`@netlify/plugin-nextjs` fijado en `devDependencies`. Las páginas van al CDN
y **todas las rutas de `app/api` corren dentro de una sola Netlify Function**
(`___netlify-server-handler`) que arma el plugin.

### Qué se comporta distinto a Vercel (revisado para esta app)

| Tema | En esta app | Veredicto |
|---|---|---|
| Cookies | No se usan: la sesión viaja en el header `Authorization` (el token de Supabase vive en `localStorage`). | Sin impacto |
| Headers | `Authorization` llega intacto a la función (probado con `netlify serve`: 401 sin token, validación 400 antes de tocar la base). | Sin impacto |
| Streaming | Ninguna ruta hace streaming; todas devuelven JSON completo. | Sin impacto |
| Tamaño | Límite 6 MB por request/respuesta. Lo más grande es un alta con notas (≤ 2000 caracteres) o un listado de personas. | Sin impacto |
| Tiempo | Límite 60 s por request, no configurable. | Sin impacto |
| Región | La función corre por defecto en **Ohio (`cmh`)** y Supabase está en **São Paulo (`sa-east-1`)**. `GET /api/jugadores` hace ~4 idas y vueltas seguidas a Supabase y cada una cruza el continente. Mover la función a `gru` (São Paulo) requiere plan **Pro**. | **Decisión: se deja en Ohio**, no vale pasar a Pro por esto. Es más lento, no roto; si molesta en el uso real, se reevalúa |
| Arranque en frío | Una sola función para todas las rutas: la primera request después de un rato sin uso tarda más (en Vercel cada ruta es su propia función). | Aceptable para un solo usuario |
| Caché | Todas las respuestas de `/api` salen con `Cache-Control: private, no-store` (`next.config.mjs`), y todo el sitio con `nosniff`, `Referrer-Policy` y sin iframes de otros sitios. Verificado con `next start`; falta mirarlo en la URL de Netlify. | Resuelto |
| Hora del servidor | UTC, igual que Vercel. Todo "hoy / mes / atrasado" se calcula en hora Argentina (`lib/fechas.js`). | Resuelto |
| `.env.local` | El plugin copia `.env.local` dentro del bundle de la función. En un deploy desde el repo conectado no existe; en un `netlify deploy --build` desde tu compu sí viajaría. | Deployar desde el repo conectado |

### Checklist (el deploy lo hacés vos)

> El sitio **ya está publicado** en Netlify. Esta lista queda como referencia
> para rehacerlo o para un segundo sitio.

1. **Login en la CLI** (solo si la vas a usar): `netlify login`. Ojo: la CLI
   de esta máquina ya tenía una sesión iniciada; si no es tu cuenta, primero
   `netlify logout`.
2. **Repo en GitHub** (puede ser privado) con este código pusheado.
3. **Netlify → Add new project → Import an existing project → GitHub** →
   elegir el repo. Netlify lee `netlify.toml`: no hace falta tocar build
   command ni publish directory.
4. **Variables de entorno, antes del primer deploy**: Project configuration →
   Environment variables → Add a variable (valores en tu `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Scopes: al menos **Builds** y **Functions**. Las `NEXT_PUBLIC_*` se
   incrustan en el JavaScript **al momento del build**: si se cargan
   después, hay que redeployar (Deploys → Trigger deploy → Clear cache and
   deploy site).
5. **Deploy.** Da una URL tipo `sistema-gestion-cobros.netlify.app` (el nombre
   se cambia en Project configuration → General → Project details).
6. **Supabase → Authentication → URL Configuration**: poner esa URL como
   **Site URL** y agregar `https://TU-SITIO.netlify.app/**` a **Redirect
   URLs**, igual que se iba a hacer con Vercel. Sin esto el link de "Olvidé
   mi contraseña" no vuelve al sitio.
7. **Alta del usuario real** (no lo hago yo, implica manejar su
   contraseña): Authentication → Users → "Add user", y anotarla en
   `app_admins` (ver [Acceso a los datos](#acceso-a-los-datos-rls-y-registro-público)):
   sin esa fila, la app se ve vacía y no deja guardar. Después cambia la
   contraseña con "Olvidé mi contraseña".
8. **Registro público**: ya está bloqueado por el trigger de `auth.users` (ver
   el mismo apartado); no hace falta tocar el panel de Auth.
9. **Activar "Leaked password protection"** (Authentication → Passwords):
   es el único aviso que dio el asesor de seguridad de Supabase.
10. **Qué probar apenas esté online**: login real; alta de un jugador y un
    alumno (con un contacto en texto libre); marcar
    una cuota como pagada y deshacerla; el contador de recordatorios del
    panel; que los montos se vean en US$; "Olvidé mi
    contraseña" de punta a punta; imprimir el resumen mensual; `/demo` sin
    login; y cuánto tarda en cargar la lista de jugadores (región).

### Probarlo local como en Netlify

```bash
netlify build --offline              # mismo pipeline que el build de Netlify
netlify serve --offline --port 8888  # sirve ese build con el runtime de funciones
```

No correr `next dev` al mismo tiempo: comparten `.next` y el `serve` empieza
a devolver 500 (pasó durante la verificación; con un build limpio, todo 200).

## Copia de seguridad, ayuda y mantener activo (tanda 6)

- **Copia de todos los datos**: Configuración › "Copia de seguridad" (`GET /api/copia`, 401 sin sesión). Un .zip con una planilla por tabla, `datos.json`, `comprobantes.csv` y `LEEME.txt`; no entrega nada si alguna tabla no coincide con el conteo de la base. Los comprobantes (archivos) no vienen adentro. Cómo restaurar: [`docs/RESTAURAR.md`](./RESTAURAR.md) (`scripts/restaurar-sql.js`). El plan gratuito de Supabase **no** tiene copias propias: conviene bajar una por mes (la app avisa a los 30 días).
- **Ayuda**: `/ayuda` ("¿Cómo hago…?"), con buscador y para imprimir.
- **Mantener activo**: `GET /api/salud` (pública, solo `{ok}`) y una función programada diaria de Netlify. Ver [`docs/MANTENER-ACTIVO.md`](./MANTENER-ACTIVO.md). No reemplaza la copia.
- Resumen y lo que no se pudo comprobar: [`docs/desarrollo/COPIA-Y-AYUDA.md`](./desarrollo/COPIA-Y-AYUDA.md).

## Nota sobre el plan free de Supabase

Los proyectos gratuitos se pausan automáticamente tras varios días sin
actividad. Si la app no responde, puede ser por esto — se reactiva desde el
dashboard de Supabase, tarda un par de minutos y no se pierden datos.

## Pendiente / a definir con vos

- **Rama `next-16-evaluacion`**: evaluación completa en
  [`docs/desarrollo/INFORME-NEXT-16.md`](./desarrollo/INFORME-NEXT-16.md) — versiones, qué
  hizo falta cambiar en el código, y una recomendación de migrar recién
  después del deploy inicial en Next 14.2.x.
- **Módulo de alumnos "estilo Excel"**: si en algún momento se quiere la
  experiencia de grilla editable completa, se puede sumar `react-data-grid`
  sobre esta misma base.
- **Sin verificar en la URL publicada** (el sitio ya está publicado en
  Netlify, con las variables públicas de Supabase en `netlify.toml`): login,
  `/demo` y que la API sin sesión devuelva 401.
- Cualquier cambio de textos o reglas de negocio que
  surja de usar la app en el día a día real.

El detalle pasada por pasada, incluyendo qué se verificó en navegador real
contra qué se verificó solo leyendo o simulando código, está en
[`docs/desarrollo/HISTORIAL.md`](../docs/desarrollo/HISTORIAL.md).
