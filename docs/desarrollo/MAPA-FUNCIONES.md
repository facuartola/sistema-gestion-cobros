# Mapa de funciones: dónde estaba y dónde está ahora

Cada función que existía antes de la simplificación (Tanda 4) y el lugar donde
se hace hoy. **Ninguna quedó sin lugar.** "Panel" es el panel lateral (en el
celular, una hoja que sube desde abajo). Atajos de teclado: siguen todos
(Ctrl+K, C, G, S, N, R), pero ya no se muestran en pantalla.

## Inicio

| Antes | Ahora |
|---|---|
| Resultado, gráfico, 4 tarjetas, "Para hacer hoy", "Próximos 7 días", "Últimos movimientos" | Panel de Inicio: indicadores, gráficos, "Para hacer", próximos 30 días, "Quién debe" y últimos movimientos (ver `docs/desarrollo/INICIO.md`) |
| "Cobré a alguien" (C) | Botón grande del Inicio, "+ Nuevo" y tecla C: ventana de cobro de un solo paso |
| "Pagué un gasto" (G) | Botón del Inicio, "+ Nuevo" y tecla G |
| "Marcar sesión realizada" (S) | "Registré una clase o sesión" (Inicio y "+ Nuevo") lleva al módulo en curso con su planilla (ahí se marcan clases y sesiones). La ventana "Marcar sesión realizada" sigue en Certificación › Alumnos › "Marcar una sesión", en el panel de cada alumno y con la tecla S |
| Nuevo cliente (N), Nuevo recordatorio (R) | "+ Nuevo" y teclas N y R |
| Variación contra todo el mes anterior | Contra el mismo tramo del mes anterior (Cobrado, Gastado y Resultado) |

## Cobros

| Antes | Ahora |
|---|---|
| Jugadores y Alumnos (2 entradas del menú con tablas) | Cobros: pestañas Jugadores y Alumnos de la certificación |
| Editar monto, fecha de pago, método, estado, nombre, contacto, notas, día de vencimiento, monto total (celdas sueltas) | Panel de la persona (Datos y Cuota del mes) |
| Marcar pagado | Botón **Cobré** (y "Estado" en el panel, con Deshacer) |
| Dar de baja | Panel › Dar de baja (con Deshacer) |
| Recordatorio desde la fila | Panel › Crear un recordatorio (abre Recordatorios con la persona ya elegida) |
| Exportar CSV, Imprimir | Menú ⋯ de Cobros: "Exportar a Excel" (se abre en Excel con columnas) e "Imprimir" |

## Gastos

| Antes | Ahora |
|---|---|
| "Todos los pagos", árbol de tipos en el menú, "Administrar categorías" | Gastos: grupos y tarjetas; pie con "Ver todos los pagos" (`/gastos/pagos`) y "Editar tipos de gasto" (`/gastos/categorias`) |
| Registrar un pago | **Pagué** (un paso) y **Registrar pago** (con comprobante) en cada tarjeta, "+ Nuevo" y tecla G |
| Pagos de liquidación a coaches | Una tarjeta "Pagos al equipo"; en el historial llevan la marca "Pago al equipo" |
| Exportar CSV de pagos | Gastos › "Exportar a Excel" |
| Punto de vencimiento en el menú | En la tarjeta de cada tipo de gasto |

## Certificación (antes 4 entradas: Resumen, Módulos, Alumnos, Equipo)

Todo en `/certificacion`: cabecera con selector y **Configurar**, tira de los 10
módulos y pestañas **Módulos | Alumnos | Equipo**.

| Antes | Ahora |
|---|---|
| Resumen: selector de certificación | Cabecera (se recuerda la elegida) |
| Resumen: Tarifas (se veían en una tarjeta) | Configurar › "Tarifas y datos de la certificación" (se ven y se editan ahí) |
| Resumen: Editar tarifas, estado de la certificación (en curso / finalizada) | Configurar › "Tarifas y datos de la certificación" |
| Resumen: Nueva certificación | Configurar › "Nueva certificación" |
| Resumen: Exportar liquidaciones | Configurar › "Exportar los pagos al equipo a Excel" |
| Resumen: aviso de tarifas faltantes con "Definirlas ahora" | Aviso arriba de la tira, con el mismo botón |
| Resumen: módulo en curso, liquidados, alumnos en condiciones | La tira de módulos (estado de cada uno) y la marca "Listo para certificar" en Alumnos |
| Resumen: Pagos pendientes al equipo + "Liquidar pendientes" | Módulos: aviso "Pagos atrasados al equipo" + **Pagar lo atrasado** (misma operación de la base) |
| Módulos: los 10 con su estado | Tira de módulos y lista de módulos en la pestaña Módulos (clases dadas de 4, sesiones hechas) |
| Planilla del módulo (clases/encuentros, prácticas finales, sesiones, tarifas especiales) | Se abre al tocar un módulo de la tira o de la lista, debajo de la tira (sin perder nada); ← Módulo anterior / Módulo siguiente → |
| "Liquidar módulo" | **Pagar al equipo**: aviso "El Módulo N terminó" en la pestaña Módulos, y botón al pie de la planilla |
| Avance de alumnos (barra "7 de 10", coach, "En condiciones de certificar") | Pestaña Alumnos ("X de 10 sesiones", coach, "Listo para certificar") |
| Inscribir alumno | Alumnos › "Inscribir alumno" (panel) |
| Marcar sesión realizada | Alumnos › "Marcar una sesión" y, en el panel del alumno, "Marcar una sesión como hecha"; también en la planilla del módulo y con la tecla S |
| Cambiar coach | Panel del alumno › Coach (con el texto "Las sesiones ya hechas quedan con el coach anterior; las pendientes pasan al nuevo") |
| Ficha del alumno (10 sesiones: módulo, coach, fecha, pago) | Panel del alumno › "Sus 10 sesiones" |
| Exportar CSV de avance | Alumnos › ⋯ › "Exportar el avance a Excel" |
| Equipo: alta | Equipo › "Agregar persona" (panel) |
| Equipo: editar (lápiz), desactivar/activar, borrar | Panel de la persona: Datos, Desactivar / Volver a activar (con Deshacer), Borrar (con confirmación) |
| Ficha de la persona: cobrado, pendiente, últimas liquidaciones, encuentros, sesiones | Panel de la persona: Cobrado, Se le debe, Dio, Últimos pagos, y Clases y Sesiones (con enlace a la planilla de cada módulo) |
| Rol de la persona | Se deduce de lo que da: profe, coach o las dos cosas (la base no guarda el rol) |
| URLs viejas `/certificacion/modulos[/id]`, `/alumnos[/id]`, `/equipo[/id]` | Siguen respondiendo: abren la pestaña que corresponde (con el panel o la planilla de ese id) |

## Recordatorios

| Antes | Ahora |
|---|---|
| Formulario con título, fecha, tipo, persona y nota | Campo arriba: título, día y persona (opcional). Tipo y nota siguen en "Editar" y viajan sin mostrarse desde las sugerencias |
| Vencidos, Hoy, Próximos 7 días, Más adelante, Hechos | Hoy (incluye lo vencido), Esta semana, Más adelante, Hechos (plegado) |
| Marcar hecho (tilde) con Deshacer | Igual |
| Sugeridos (siempre a la vista) | "Sugerencias", sección plegada |
| Editar y eliminar | Igual |
| Recordatorio desde la fila de una persona | Desde el panel de la persona (llega con la persona elegida y el cursor en el título) |

## Configuración y varios

| Antes | Ahora |
|---|---|
| Errores del sistema, Modo demo, Exportaciones, Tipos de gasto (administración) | Configuración (menú del usuario; en el celular, el avatar de la barra superior) |
| Cerrar sesión (debajo del menú) | Menú del usuario |
| Cajón del celular | Barra de navegación inferior con las 5 entradas |
| 4 relojes en la barra | Uno solo; al tocarlo, los otros tres |

## Tanda final (2026-10-06)

| Antes | Ahora |
|---|---|
| Inicio con ~14 bloques en una sola pantalla | Dos vistas: **Hoy** (frase, tres botones, Para hacer, Quién debe y tres números) y **Análisis** (indicadores, gráfico principal, gráficos secundarios, próximos 30 días, proyección y últimos movimientos). Código en `app/page.js` y `components/inicio/` |
| Selector de tramo en la cabecera | Junto a las pestañas, solo en Análisis |
| Gastos › «Editar tipos de gasto» (`/gastos/categorias`) | Gastos › **«Mis gastos»** (`/gastos/mis-gastos`; la dirección vieja sigue respondiendo). `components/MisGastos.js` y `components/TipoGastoModal.js` |
| Un tipo de gasto no se podía mover | «Editar» › «Dentro de» lo mueve a otra carpeta (el historial lo sigue) |
| Elegir un tipo en «Registrar pago» | Además, «+ Crear un tipo nuevo» al final del selector |
| Reloj de Argentina; los otros al tocarlo; ninguno en el celular | Cuatro ciudades en una línea (≥ 1270 px), compacto, y en el menú del usuario en el celular |
| Certificación sin impresión | «Imprimir» en el «⋯» de Módulos, Alumnos y Equipo |
