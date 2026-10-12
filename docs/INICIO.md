# Panel de Inicio (Tanda 5)

El Inicio pasó de una lista con un resumen colapsado a un panel financiero
siempre visible ("Para hacer" se puede ocultar y mostrar, y se recuerda en el navegador). La administradora sigue viendo arriba, sin pensar, qué hacer (frase
principal, tres botones y "Para hacer"); debajo y al costado están los
indicadores y los gráficos, todos de solo lectura.

**Estado: terminado.** Falta solo lo que se anota en "Pendiente" al final.

## Qué muestra cada bloque y de dónde sale cada número

Una sola carga de datos para todo el panel (`app/page.js`): las cuotas del mes
(`/api/jugadores` y `/api/alumnos`), el resumen de siempre (`/api/resumen`:
gastos por pagar, vencimientos, movimientos y certificación) y la ruta nueva
`/api/panorama`. Cambiar de período no vuelve a pedir nada: se recalcula en el
navegador.

**Cobrado y gastado cuentan por fecha de pago** (la plata que entró o salió ese
mes, aunque la cuota sea de otro) y **los clientes dados de baja cuentan**: la
plata entró. Esa regla ya era la de Inicio; ahora vive en un solo lugar (las dos
vistas de la base) en vez de repetirse en la ruta de resumen.

| Bloque | Qué dice | De dónde sale |
|---|---|---|
| Cabecera | Saludo, fecha, selector de período (Este mes, Últimos 6 meses, Este año) | El período se recuerda en el navegador (`inicio_periodo`, nunca en `/demo`) y gobierna solo los gráficos de abajo; los indicadores son siempre del mes de hoy |
| Frase principal y tres botones | "Te faltan cobrar…" | Cuotas del mes de hoy sin pagar (`estadoDeCobrosDelMes`) y `gastosPorPagar` del resumen |
| **Resultado del mes** (dorado) | Cobrado menos gastado, variación y tendencia de 6 meses | Vista `cobros_mensuales` y vista `gastos_mensuales_por_tipo`, mes de hoy; variación contra el mismo tramo del mes anterior (ver "Variación del mes") |
| Cobrado del mes | Total cobrado con fecha de pago en el mes | `cobros_mensuales` (solo cuotas pagadas) |
| Gastado del mes | Total pagado con fecha de pago en el mes | `gastos_mensuales_por_tipo` |
| Por cobrar | Monto de las cuotas del mes sin pagar, personas y atrasadas | Cuotas del mes y `estadoDeCobro` (`lib/cobros.js`), igual que la pantalla de Cobros |
| Tasa de cobranza | Pagado sobre lo esperado del mes, en % | Cuotas del mes: monto de las pagadas / monto de todas (personas activas) |
| Ingresos y gastos | Barras agrupadas por mes (ingresos dorado, gastos hueso) con el resultado neto encima | Las dos vistas; "Este mes" y "Últimos 6 meses" muestran 6 meses (una tendencia de un mes no dice nada), "Este año" muestra de enero al mes actual (mínimo 3 meses) |
| Para hacer | Hoy y Esta semana: cobros, gastos y recordatorios | La lógica de siempre (`armarPendientes`, `armarParaHacer`); primeras 6 cosas, el resto con "Ver las N" |
| Cobros del mes | Anillo Pagó / Por vencer / Atrasado con el esperado en el centro | `estadoDeCobrosDelMes` (cuotas del mes de hoy) |
| Gastos por tipo | Anillo con el reparto por tipo; al tocar un tipo, su detalle | `gastos_mensuales_por_tipo`; el tipo es el nivel 2 del árbol de la ruta ("Equipo de marketing"); si el nivel 2 es un tipo final ("Gastos fijos > Wifi") se agrupa por el nivel 1. Máximo 5, el resto en "Otros" |
| Cobros por método | Efectivo, transferencia y (si hay cobros viejos) sin método | `cobros_mensuales`, columna `metodo` |
| Certificación | Alumnos según sesiones hechas (0 a 10), módulo en curso, listos para certificar | `obtenerCertificacion` (vista `progreso_certificacion`) y `certificaciones[0]` del resumen. Solo si hay una certificación |
| Proyección del mes | "Si todos pagan, cerrás octubre con US$ X, un margen del N %" | Cobrado + por cobrar − gastado − gastos por pagar con monto (los que no tienen monto se avisan aparte) |
| Quién debe | Hasta 5 clientes con deuda, con monto y días de atraso | `quienDebe` (usa `meses_adeudados` de la API, que viene de `lib/deuda.js`); "Cobré" si lo que se debe es la cuota de este mes, "Ver" (a Cobros) si es de meses anteriores |
| Próximos 30 días | Barras por semana: lo que se espera cobrar contra los gastos que vencen | `proximosDias`: cuotas sin pagar de este mes y del que viene según el día de vencimiento, y `gastosPorHacer` a 30 días (`lib/gastos.js`) |
| Últimos movimientos | Cobros y pagos con signo, fecha y método | `movimientos` del resumen |

Las cuentas están en `lib/panorama.js` (puras, con tests en
`lib/panorama.test.js`): series mensuales, variaciones (sin base cuando el mes
anterior es 0, nunca divide por cero), repartos, tasa, proyección, quién debe,
próximos 30 días y ejes.

## Coherencia con el resto de la app

- **Gastado**: igual a "Este mes pagaste" de Gastos y a los CSV de pagos.
- **Cobrado del mes**: por fecha de cobro. La pantalla de Cobros cuenta las
  cuotas **por mes de la cuota**, que puede diferir (una cuota de octubre pagada
  el 28 de septiembre es de octubre en Cobros y de septiembre en el Inicio). Se
  dejó una aclaración en el pie de Cobros.
- **Por cobrar, atrasados, tasa y anillo**: salen de las mismas cuotas y la misma
  regla (`estadoDeCobro`) que Cobros.
- **Variación del mes**: Cobrado, Gastado y Resultado se comparan contra el
  **mismo tramo del mes anterior**: del 1 al día de hoy contra del 1 al mismo día
  del mes pasado (si el mes pasado es más corto, contra todo ese mes). Así, a
  principio de mes no aparecen bajas engañosas. Cada indicador lo dice: "vs. el
  mismo tramo del mes anterior (del 1 al 5)". Si el tramo anterior no tiene
  movimientos, en lugar de un porcentaje se lee "Sin datos del mismo tramo del
  mes anterior" (tono neutro). Los números salen de `diarios` en
  `GET /api/panorama` (cuotas pagadas y pagos de gasto por día, del 1 del mes
  anterior a hoy; `agruparPorDia`, `tramosDeComparacion` e `indicadoresDelMes`
  en `lib/panorama.js`, con tests). El valor grande y la mini línea siguen siendo
  mensuales.

## Gráficos

SVG propio y liviano, sin librerías (`components/panel/`): barras agrupadas con
línea (`BarrasAgrupadas`), anillo (`Anillo`), mini línea (`Sparkline`),
histograma de sesiones (`Histograma`) y la tarjeta que los contiene
(`Tarjetas.js`). Colores y tipografías, siempre de los tokens de `:root`
(se sumaron `--azul` y `--lila` para los repartos).

- **Entrada**: barras, líneas y anillos crecen una vez al cargar (600 a 700 ms) y
  no se vuelven a animar al cambiar de período; nada se mueve solo. Se apaga con
  `prefers-reduced-motion` (regla global del final de `globals.css`).
- **Accesibilidad**: cada gráfico tiene un resumen en texto para lectores de
  pantalla y un botón "Ver como tabla"; cada mes, barra o tipo es enfocable con
  el teclado y muestra el tooltip de vidrio al enfocarlo. Los repartos se pueden
  recorrer con Tab y se eligen con Enter o espacio. El contraste está medido en
  `lib/contraste.test.js` (texto a 4,5:1; barras, anillos y líneas a 3:1; la
  medición hizo subir la opacidad del hueso de las barras de gastos de 0,34 a
  0,5).
- **Estados vacíos**: cada tarjeta explica qué falta cargar para ver el gráfico;
  mientras carga hay un esqueleto con la forma de la tarjeta.
- **Responsive**: 12 columnas en 1280 px o más (cuatro gráficos en fila desde
  1700 px, dos por fila antes), 6 columnas hasta 1279 px y una columna en el
  celular, ordenada por importancia: resultado, qué hacer, quién debe y los
  gráficos debajo. Capturas en `docs/capturas/inicio-demo-*.png` (1920, 1440,
  1024 y 390 px, de `/demo`).

## /demo

`lib/panoramaDemo.js` arma 12 meses de historia coherente con tendencia
creciente, métodos de pago (con cobros viejos sin método), gastos repartidos
entre todos los tipos del árbol, atrasados y deudores, y la certificación de
ejemplo. El mes actual sale de lo que hay en memoria, así que lo que se cargue
en la demo se ve en los gráficos. Todo en memoria: no llama a la API.

## Diferencias con la consigna

- **Sin mini línea en "Por cobrar" y "Tasa de cobranza"**: las vistas no dan
  historia de lo esperado de cada mes (habría que reconstruir cuotas pasadas).
  Llevan una barra (atrasado contra por vencer; pagado contra esperado).
- **"Este mes" en el gráfico principal** muestra 6 meses (el mes actual al
  final): una barra sola no es una tendencia. Los anillos y el reparto por método
  sí se limitan al mes.
- **Quién debe incluye deuda de meses anteriores** (como Marcelino M, que "debe
  1 mes" sin estar atrasado este mes). Para esos casos el botón lleva a Cobros en
  vez de registrar un cobro, porque el botón "Cobré" registra la cuota del mes y
  la base no dice de qué mes es la deuda. El monto es la cuota del mes (si está
  atrasada) más los meses anteriores a la cuota mensual actual: es una
  estimación.
- **Próximos 30 días**: las cuotas del mes que viene todavía no existen, así que
  se espera la cuota mensual del cliente en su día de vencimiento; los clientes
  sin día de vencimiento no entran. Los gastos sin monto cargado no suman
  (se avisa cuántos son).
- **"Para hacer" muestra 6 cosas** y el resto con "Ver las N", y en escritorio
  ancho ocupa la altura del gráfico principal (la lista se desplaza por dentro).
- **Se retocó el pie de Cobros** (una frase) para aclarar la diferencia entre
  "por mes de la cuota" y "por fecha de cobro"; el resto de la app no cambió. En
  el menú de gastos de `/demo` se cargaron montos a Wifi, Celulares y Zoom, para
  que la demo no muestre "Primeros pasos".
- **Capturas**: son de `/demo` (viewports exactos con Chrome sin cabeza). No hay
  captura con datos reales porque la sesión real solo se puede ver en la
  pestaña del usuario.

## Pendiente

- Nada obligatorio. Idea que quedó afuera: una vista diaria del mes actual (los
  gráficos siguen siendo mensuales; solo la variación usa datos por día).

## Tanda final: dos vistas, bloques seguros y valores extremos

- **Dos vistas** arriba del contenido (pestañas con flechas, Inicio y Fin; se recuerda en el navegador con `try/catch`, clave `inicio_vista`; /demo siempre arranca en «Hoy» y muestra las dos):
  - **Hoy** (por defecto): saludo, frase principal, los tres botones, «Para hacer» (con su botón de ocultar), «Quién debe» y tres números: Por cobrar, Cobrado del mes y Resultado.
  - **Análisis**: los cinco indicadores, «Ingresos y gastos», cobros del mes, gastos por tipo, cobros por método, certificación, proyección, próximos 30 días y últimos movimientos. El selector de tramo vive acá.
  - Los números son los mismos que en las otras pantallas: salen de las mismas funciones (`lib/panorama.js`).
- **Un bloque que falla no tumba la pantalla**: cada bloque está en un `BloqueSeguro` (mensaje amable + «Reintentar», el error queda en `errores_app`). Los datos de `/api/resumen` y `/api/panorama` se normalizan al llegar (`lib/inicioDatos.js`) y los cálculos tienen respaldo (`calcularInicio`).
- **Con la base vacía** cada bloque muestra un estado vacío que dice qué cargar (clientes, un primer cobro o pago, gastos, inscriptos…), con enlace a la pantalla.
- **Valores extremos** (`recorteDeValores` en `lib/panorama.js`): si un valor supera 4 veces la mediana del resto (sin contar ceros ni el propio valor; hacen falta al menos 2 valores), la barra se dibuja cortada con dos rayas, el eje se arma sin ese valor, y el valor real aparece en el tooltip («Barra cortada…») y en «Ver como tabla». Vale para «Ingresos y gastos» y «Próximos 30 días».
- **Gastos por tipo**: un pago cuenta en la carpeta que contiene a su tipo (un tipo suelto en el primer nivel cuenta por su nombre). Ver `gastosPorGrupo`.
- **Gastos sin monto**: la frase dice «y N gastos sin monto cargado» con el enlace «Cargar los montos» (`fraseGastosPorPagar`).
