# Simplificación del sistema (Tanda 4)

Objetivo: que la administradora lo entienda sin explicación. **No se pierde ninguna
función**: se mueve, se agrupa o se esconde. Sesión 1: Fases 0 y 1; sesión 2:
Fase 2 (Cobros y Gastos); sesión 3: Fase 3 (Certificación, Recordatorios,
textos y celular) y los ajustes finales. Estado: **todas las fases hechas.**
Dónde quedó cada función: `docs/desarrollo/MAPA-FUNCIONES.md`.

## Fase 0. Inventario

Frecuencia: D diaria, S semanal, M mensual, R rara, T técnica.

| Pantalla, botón o atajo | Frec. | Ahora | Diseño nuevo |
|---|---|---|---|
| Inicio (resultado, gráfico, 4 tarjetas, Para hacer hoy, Próximos 7 días, Últimos movimientos) | D | Todo suelto, 3 listas | Frase, 3 botones, **Para hacer** (Hoy y Esta semana), resumen del mes colapsado (**hecho**) |
| Cobré a alguien (C) / Registrar cobro | D | Ventana | Botón grande + "+ Nuevo" (**hecho**) |
| Pagué un gasto (G) | S | Ventana | Botón grande + "+ Nuevo" (**hecho**) |
| Marcar sesión (S) | S | Ventana | Botón "Registré una clase o sesión" (**hecho**) |
| Nuevo cliente (N), Nuevo recordatorio (R) | M | "+ Nuevo" | "+ Nuevo", sin letras (**hecho**) |
| Jugadores / Alumnos (tablas con celdas editables) | D | 2 entradas del menú | Cobros con pestañas (**hecho**); panel lateral en vez de celdas editables (**hecho**, Fase 2) |
| Gastos: "Todos los pagos", árbol en el menú, Administrar categorías | S / R | 3 entradas + árbol | Entrada **Gastos** con los tipos como grupos (**hecho**); tarjetas y botón de pagar (**hecho**, Fase 2) |
| Página de un tipo de gasto | S | Árbol del menú | Se llega desde Gastos (**hecho**) |
| Certificación: Resumen, Módulos, Alumnos, Equipo | S | 4 entradas | 1 entrada con tira de 10 módulos y pestañas Módulos | Alumnos | Equipo (**hecho**, Fase 3) |
| Planilla del módulo, "Liquidar" | M | Texto técnico | Mismo lugar, debajo de la tira; "Pagar al equipo" (**hecho**, Fase 3) |
| Recordatorios (contador) | S | Entrada | Entrada con contador; lista simple con grupos Hoy, Esta semana, Más adelante y Hechos (**hecho**, Fase 3) |
| Relojes (4) | R | 4 en la barra | Uno solo; al tocarlo, los otros tres (**hecho**) |
| Ctrl+K | S | Visible | Sigue, sin pista en pantalla (**hecho**) |
| Errores del sistema, Modo demo, Exportaciones, Tipos de gasto (admin) | R / T | Suelto o escondido | **Configuración**, desde el usuario (**hecho**) |
| Cerrar sesión | R | Debajo del menú | Menú del usuario (**hecho**) |
| Cajón del celular | D | Menú lateral | Barra inferior fija con las 5 entradas (**hecho**, Fase 3) |

Duplicaciones detectadas: tres listas de lo que hay que hacer (Para hacer hoy,
Próximos 7 días, sugerencias) y cuatro lugares para cada registro (botón, menú,
atajo, tabla). Textos técnicos que se revisaron en la Fase 3: "Liquidar" y
"liquidación" en la ventana y la planilla del módulo, "categoría" en la
administración de tipos de gasto y "período" en la ventana de pago.

## Fase 1. Hecho

1. **Menú de 5 entradas** (`NAV_MENU`): Inicio, Cobros, Gastos, Certificación y
   Recordatorios con contador. La entrada madre queda marcada en sus
   subpantallas (test). El punto de vencimiento ahora está en Gastos.
2. **Entradas sin huérfanos**: Cobros (pestañas Jugadores | Alumnos), Gastos
   (`/gastos`: tipos de gasto desde la base, hasta 3 niveles, con vencimientos;
   todos los pagos pasaron a `/gastos/pagos`) y Certificación (fila Resumen |
   Módulos | Alumnos | Equipo).
3. **Usuario con menú** (Configuración y Cerrar sesión) y `/configuracion`.
4. **Barra superior**: buscador, un reloj (Argentina; Miami, Paraguay y México
   al tocarlo) y "+ Nuevo" sin letras. Los atajos siguen.
5. **Inicio nuevo**: saludo, frase principal, tres botones, "Para hacer",
   "Primeros pasos" (se deduce de los datos) y resumen del mes colapsado.
   El método usado la última vez queda preseleccionado en cobros y pagos.
6. Las URLs viejas siguen funcionando (salvo que `/gastos` ya no es la lista de
   pagos: esa está en `/gastos/pagos`).

### Diferencias con la consigna
- **"Registré una clase o sesión"** abre la ventana de sesiones (la única que
  existía). Las clases se marcan en la planilla del módulo: la ventana lo dice y
  enlaza al módulo en curso. Motivo: no existía una ventana de clases.
- **El método recordado no se pudo comprobar en la app real** (la extensión de
  Chrome no estaba conectada); está cubierto con tests y en `/demo` no se
  guarda nada a propósito.
- **Una cosa en "Esta semana"**: los gastos que todavía no vencen pasaron de
  "Para hacer hoy" a "Esta semana", para no repetirlos.
- Vocabulario: se cambió en el Inicio y el menú; "liquidar" sigue en la ventana
  y la planilla del módulo hasta la Fase 3.

## Fase 2. Hecho (sesión 2)

### 2A. Cobros (`/cobros`)
- Una sola pantalla con las pestañas Jugadores y Alumnos de la certificación
  (la elegida se recuerda). `/jugadores` y `/alumnos` redirigen
  (`next.config.mjs`); en `/demo` también.
- Filas de solo lectura: nombre, monto, vencimiento, estado (Pagó, Atrasado,
  Vence el N, Sin vencimiento), barra de avance (alumnos con monto total) y
  **Cobré**, que abre la ventana de cobro de un solo paso con Deshacer.
- Tocar la fila abre el **panel lateral** (hoja inferior en el celular).
- Menú **⋯**: Exportar CSV e Imprimir.

Dónde quedó cada función de las tablas viejas (verificado contra el inventario):

| Función de la tabla vieja | Ahora |
|---|---|
| Editar monto (celda) | Panel: "Monto de la cuota" (este mes) y "Monto mensual" (cuotas nuevas) |
| Editar fecha de pago (celda) | Panel: "Fecha de pago" de la cuota |
| Método (lista) | Panel: "Cómo pagó"; "Cobré" lo preselecciona |
| Marcar pagado / volver a pendiente (badge) | "Cobré" (pagar) y panel: Estado (volver a pendiente, con Deshacer) |
| Editar nombre (clic) y lápiz "Editar cliente" | Panel: Datos (nombre, contacto, notas, día, monto total) |
| Dar de baja | Panel, con confirmación y Deshacer |
| Recordatorio de la fila | Panel: "Crear un recordatorio" |
| "debe N meses", contacto | En la fila ("debe N meses") y en el panel |
| Cobrado del mes y del año | Línea al pie de la lista; "Cobrado este año" por persona en el panel |
| Imprimir, Exportar CSV, buscador por nombre | ⋯, ⋯, buscador arriba (Ctrl+K lleva a la pestaña y al nombre) |
| Total abonado / monto total | Barra en la fila y en el panel |

### 2B. Gastos "¿Qué pagaste?" (`/gastos`)
Grupos y tarjetas desde la base, ordenadas por vencimiento; **Pagué** en un paso
con Deshacer; **Registrar pago** con comprobante; una sola tarjeta "Pagos al
equipo" para el equipo de coaches; "Ver historial" de cada tarjeta y grupo;
pie con "Ver todos los pagos" y "Editar tipos de gasto"; punto de vencimiento en
la tarjeta (ya no en el menú). Detalle en el CHANGELOG.

### Diferencias con la consigna (Fase 2)
- **`/cobros` no existía como ruta**: la Fase 1 dejaba el menú apuntando a
  `/jugadores`. Se creó `/cobros` y las rutas viejas redirigen.
- **Se agregó un `GET` de solo lectura** a `/api/jugadores|alumnos/[id]/cuotas`
  para las "últimas cuotas" del panel (la API no tenía cómo leerlas; la
  alternativa era pedir toda la lista seis veces). No se tocó la base.
- **"Cobré" no aparece en una fila ya cobrada**: la fila dice "Pagó"; para
  corregir esa cuota se usa el panel.
- **"Pagué" sin método recordado** (la primera vez en un navegador) abre la
  ventana en vez de registrar solo, porque la base exige el método.
- **"Pagué" solo cuando el tipo tiene monto**; sin monto la tarjeta dice
  "Registrar pago" (hoy Wifi y Celulares no tienen monto cargado).
- **El orden** es dentro de cada grupo y entre grupos, no una lista aparte de
  "lo que vence": así no se repite lo mismo en dos lugares.
- **Se sacó "Pagué un gasto" de la cabecera de Gastos** (la consigna pide título,
  línea y buscador); sigue en el Inicio, en "+ Nuevo" y con la tecla G.
- **El historial de pagos usa los últimos 1.000 pagos** (límite que ya tenía la
  API): con más, "Último pago" de un tipo muy viejo podría no verse.
- Los textos "Administrar categorías" (título de la pantalla de tipos de gasto)
  y "Elegí una categoría" (ventana de pago) siguen: son de la Fase 3.

## Fase 3. Hecho (sesión 3)

### Paso 0. El primer clic que no respondía
Reproducido en la versión compilada (`npm run build` y `npm start`): con
`/demo`, un clic dado apenas aparece el menú, antes de que React enganche los
eventos, se perdía (2 de 5 cargas a velocidad normal). Solución general
(`components/PaginaLista.js`): un script en el `<body>` frena y guarda el último
clic en un botón o enlace mientras la página no está lista, y se repite al
terminar de cargar (si pasaron menos de 5 s y el elemento sigue ahí); mientras
tanto el cursor muestra "cargando". 0 fallos en 18 pruebas (3 series, una con la
CPU 4 veces más lenta). El candado de doble clic no cambió: tres clics rápidos en
los botones de guardar siguen creando una sola cosa (comprobado en vivo).

### 3A. Certificación en una sola página
- `/certificacion`: cabecera con una línea explicativa, selector (se recuerda) y
  **Configurar** (tarifas y datos, nueva certificación y exportar los pagos), la
  **tira de los 10 módulos** (Pagado, Listo para pagar, En curso, Sin empezar,
  desde `estado_modulos`) y las pestañas **Módulos | Alumnos | Equipo** (la
  elegida se recuerda). Tocar un módulo abre su planilla debajo de la tira.
- **Módulos**: aviso "El Módulo N terminó: hay que pagar US$ X a P personas" con
  **Pagar al equipo** (detalle por persona, fecha, método obligatorio,
  confirmación y candado), aviso "Pagos atrasados al equipo: US$ X" con **Pagar
  lo atrasado** (`liquidar_pendientes`) y la lista de módulos con clases dadas
  de 4 y sesiones hechas.
- **Alumnos**: "X de 10 sesiones", coach y "Listo para certificar"; inscribir,
  cambiar el coach y la ficha con las 10 sesiones, en el panel lateral.
- **Equipo**: rol (profe, coach o las dos, deducido de lo que da), lo cobrado y
  lo que se le debe; alta, edición, desactivar y borrar en el panel.
- Las direcciones viejas (`/modulos`, `/alumnos`, `/equipo` y sus fichas) siguen
  respondiendo y abren su pestaña con el panel o la planilla que corresponda.
- "Registré una clase o sesión" (Inicio y "+ Nuevo") lleva al módulo en curso
  con su planilla; "Revisar y pagar" de "Para hacer" lleva a la pestaña Módulos.
- **Mensajes de la base traducidos en la API** (`lib/mensajesApi.js`, un solo
  mapa, con tests): "Este módulo ya fue liquidado" pasa a "Este módulo ya fue
  pagado", "…antes de liquidar" a "…antes de pagar al equipo" y "Faltan las
  categorías de pago…" a "Faltan los tipos de gasto de pago…". Un mensaje
  desconocido pasa igual. Los pagos viejos que dicen "Pendientes" se muestran
  como están.
- Cambios de datos solo de lectura: `GET /api/equipo?resumen=1` (lo cobrado y el
  rol), `GET /api/certificaciones/[id]` suma `listos` y `tardios`, y la ficha de
  una persona suma `modulo_id` a sus clases y sesiones. No se tocó la base.

### 3B. Recordatorios y textos
- `/recordatorios`: campo arriba (título, día y persona opcional), grupos Hoy
  (con lo vencido), Esta semana y Más adelante, Hechos plegado, Deshacer al
  marcar hecho y "Sugerencias" plegadas. Crear uno desde el panel de un cliente
  llega con la persona elegida y el cursor en el título.
- **Revisión de textos** de toda la app contra la lista de palabras prohibidas
  (liquidar, liquidación, liquidado, pendientes, período, categoría,
  recurrencia, cuota actual). Un test (`lib/vocabulario.test.js`) recorre los
  textos del código para que no vuelvan. Lo cambiado:

| Antes | Ahora |
|---|---|
| Administrar categorías (título y entrada) | Editar tipos de gasto |
| Elegí una categoría… / Elegí la categoría del gasto | Elegí un tipo de gasto… / Elegí el tipo de gasto |
| Categoría (columnas, campos y filtros), Categorías de gasto (buscador) | Tipo de gasto, Tipos de gasto |
| Agregar / Editar categoría, Categoría principal, Categoría desactivada | Agregar / Editar tipo de gasto, Tipo de gasto principal, Tipo de gasto desactivado |
| subcategorías | subtipos |
| Buscar persona, categoría o sección | Buscar persona, tipo de gasto o sección |
| Liquidar módulo, Liquidar pendientes, Liquidando… | Pagar al equipo, Pagar lo atrasado, Pagando… |
| Liquidación (marca en Gastos), pago de liquidación | Pago al equipo |
| "La usa la liquidación de coaches…" | "Lo usa el pago al equipo de coaches…" |
| Exportar liquidaciones, Exportar CSV | Exportar los pagos al equipo a Excel, Exportar a Excel |
| Pagos pendientes al equipo, Pendientes (descripción del pago) | Pagos atrasados al equipo, Pagos atrasados |
| Período (columna de Gastos), "El período del pago no es válido" | Mes, "El mes del pago no es válido" |
| Período de los gráficos, "en este período" | Tramo de los gráficos, "en este tramo" |
| "La recurrencia tiene que ser…", "configurá la recurrencia" | "Elegí cada cuánto se paga…", "configurá cada cuánto se paga" |
| N pendientes (contador de Recordatorios, lectores de pantalla) | N por hacer |
| Encuentro(s) en pantallas de Certificación | Clase(s) (el tipo de gasto "Pago de encuentros" es de la base y no se toca) |
| Dictado / Pendiente (clases y sesiones) | Dada / Falta darla, Hecha / Falta hacerla |
| Vencidos / Próximos 7 días / Sugeridos (Recordatorios) | Hoy (con lo vencido) / Esta semana / Sugerencias |

### 3C. Celular
- **Barra de navegación inferior fija** con las 5 entradas (y el contador en
  Recordatorios) en lugar del cajón; el menú del usuario (Configuración y Cerrar
  sesión) se abre desde el avatar de la barra superior.
- Paneles y ventanas suben como hojas desde abajo (las ventanas con los botones
  de guardar pegados al borde inferior), con botones de al menos 44 px, sin
  scroll horizontal y con la barra inferior escondida mientras una hoja está
  abierta (así nunca tapa los botones). Comprobado a 390 px, en `/demo` y con la
  sesión real.

### Ajustes finales
- **A. Comparación de Inicio**: Cobrado, Gastado y Resultado comparan el mismo
  tramo del mes anterior (del 1 al día de hoy contra del 1 al mismo día), lo
  dicen en cada indicador y, sin movimientos en ese tramo, muestran "Sin datos
  del mismo tramo del mes anterior". Tests y `docs/desarrollo/INICIO.md` al día.
- **B. CSV en Excel**: separador `;` (y coma decimal en los números) cuando el
  navegador usa coma decimal, y `,` en los demás casos; BOM UTF-8, comillas
  duplicadas y saltos de línea entre comillas. Los menús dicen "Exportar a Excel
  – Se abre en Excel con columnas". Con tests (`lib/csv.test.js`).
- **C. /demo** refleja todo lo nuevo (Certificación en una página, Recordatorios,
  barra inferior, panel de Inicio) sin ningún pedido a la API ni a Supabase
  (verificado registrando los pedidos de red durante un recorrido).
- **Corrección encontrada en las pruebas en vivo**: un cliente nuevo cargado en
  Cobros no aparecía en "Inscribir alumno" hasta recargar; ahora Cobros avisa al
  resto de la app (`refrescar`).

### Diferencias con la consigna (Fase 3 y ajustes)
- **Las direcciones viejas no hacen un redireccionamiento HTTP**: responden con
  la misma página y abren la pestaña que corresponde (la dirección queda como
  estaba). Motivo: el panel y la planilla se abren por esa dirección y un
  redireccionamiento perdía el id.
- **Las tarifas ya no se ven en una tarjeta fija**: se ven y se editan en
  Configurar › "Tarifas y datos de la certificación". Motivo: la pantalla quedó
  organizada por tareas y no por datos.
- **Tipo y nota de un recordatorio** salen del formulario de alta (que ahora
  tiene título, día y persona); siguen en "Editar" y las sugerencias los llevan
  sin mostrarlos.
- **El separador del CSV** además de la coma decimal del idioma del navegador usa
  `;` cuando el idioma es `es-419` o cuando la zona horaria es la de Argentina
  (`America/Argentina/…` o `America/Buenos_Aires`). Motivo: el Chrome de esta
  instalación informa `es-US` (coma, por la regla del idioma) en una máquina
  argentina, y con comas Excel abre todo en una columna.
- **"Pagar lo atrasado" paga todo lo hecho y no pagado** (así funciona
  `liquidar_pendientes`), también lo de módulos todavía abiertos; el aviso de
  arriba cuenta solo lo atrasado de módulos ya pagados. Si hay diferencia, la
  ventana lo aclara.
- **Con una hoja abierta, la barra inferior se esconde** (en vez de dejar lugar
  debajo de la hoja), para que no pueda tapar los botones de guardar.
- **"Borrar" una persona del equipo** no se probó en vivo (haría falta crear una
  más sin historial); el flujo conserva la confirmación, el mensaje y la API de
  antes.

## Falta
- Nada obligatorio. Pendiente de la verificación aparte que pide el usuario.

## Tanda final: qué se simplificó (2026-10-06)

- **Inicio**: de ~14 bloques a lo que se necesita cada día (vista «Hoy»); el análisis quedó a un clic en la pestaña «Análisis», sin cambios.
- **Gastos**: el administrador de tipos pasó a «Mis gastos», con las preguntas justas: Nombre, Dentro de, ¿Se repite? (No / Cada mes / Una vez al año), Monto habitual y día de vencimiento. Se quitaron las palabras «categoría», «recurrencia» y «período» de la pantalla; las carpetas solo ordenan.
- **Un tipo nuevo no obliga a salir del pago**: se crea dentro de la misma ventana.
- **Se sacaron las ventanas del navegador** (`window.confirm`) de Mis gastos: desactivar avisa y ofrece «Deshacer»; borrar confirma en la misma fila.
- Textos nuevos: «Cargar los montos», «Monto habitual», «Automático: lo genera Pagar al equipo», «Mostrar desactivados».
- Diferencias con la consigna: ver `docs/desarrollo/TANDA-FINAL.md`.
