# Auditoría del sistema

Fecha: 4 y 5 de octubre de 2026. Alcance: toda la app (cobros, gastos,
certificación, equipo, recordatorios, `/demo`), la base de Supabase (solo
lectura) y la operación. Mirada de revisor externo: cada punto se probó; lo
que no se pudo probar se dice.

**Cómo se probó.** Con la sesión real de Facu en Chrome contra la app local
(`next dev`, misma base que producción), con datos TEST; con Chrome sin cabeza
contra `/demo` y el login; con `curl` sin sesión y con la clave pública
(anónima) de Supabase; con un build de producción hecho desde un clon limpio;
y con el MCP de Supabase en modo lectura. No se modificó ningún dato real ni
el esquema.

Severidad: **crítico** (pérdida o exposición de datos, plata mal pagada),
**alto** (puede pasar en el uso normal y duplica o esconde plata), **medio**
(falla en un caso posible, o falta una defensa), **bajo** (detalle o
prolijidad).

## Resumen

No se encontró nada crítico. Hubo un hallazgo alto en la experiencia de uso,
ya arreglado: un doble clic podía duplicar pagos y clientes. Se arreglaron 15
puntos de bajo riesgo (con commit chico y test o prueba en vivo). Quedan 12:
9 propuestas que son decisiones de negocio o de arquitectura, 1 tarea de
configuración del dueño, 1 archivo para borrar y 1 explicación.

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | **Alto** | Tres clics rápidos en "Registrar pago" o "Agregar cliente" creaban tres pagos o tres clientes | Arreglado |
| 2 | **Alto** | Los pagos de liquidación no se podían editar: sin comprobante, sin corregir el método (Parte 0) | Arreglado |
| 3 | Medio | Por la API se puede liquidar un módulo que no está listo (lo cierra sin pagar), y no hay forma de cancelar un encuentro regular | Propuesto |
| 4 | Medio | `/api` sin `Cache-Control` y el sitio sin encabezados básicos de seguridad | Arreglado |
| 5 | Medio | La planilla de liquidaciones encontraba los pagos de "pendientes" por su descripción, que ahora se puede editar | Arreglado |
| 6 | Medio | La impresión de las tablas salía casi en blanco (título, montos, fechas, métodos) | Arreglado |
| 7 | Medio | Faltan restricciones en la base en las tablas de la primera etapa | Propuesto (SQL abajo) |
| 8 | Medio | El CSV usa coma y punto decimal: el Excel de Argentina probablemente lo abra en una sola columna | Propuesto |
| 9 | Medio | `next` 14.2.35 con avisos de seguridad sin parche en la rama 14 | Propuesto |
| 10 | Medio | No hay exportación completa de los datos | Propuesto (diseño abajo) |
| 11 | Medio | "Leaked password protection" desactivada en Supabase Auth | Del dueño |
| 12 | Bajo | Inyección de fórmulas en el CSV (un texto que empiece con `=`) | Arreglado |
| 13 | Bajo | `/api/errores` respondía 500 a un cuerpo que no es JSON | Arreglado |
| 14 | Bajo | `/api/resumen` recorría las certificaciones de a una (~1,2 s) | Arreglado (~0,4 s) |
| 15 | Bajo | Rótulos de las tablas de cuotas que no aclaraban que cuentan por mes de la cuota | Arreglado |
| 16 | Bajo | Horas del registro de errores en 12 horas sin a. m./p. m. | Arreglado |
| 17 | Bajo | Nombres de archivo CSV sin tildes rotos ("auditor-a") | Arreglado |
| 18 | Bajo | Campo del comprobante sin etiqueta accesible | Arreglado |
| 19 | Bajo | `X-Powered-By: Next.js` | Arreglado |
| 20 | Bajo | Contraste de los textos nuevos no estaba medido en el test | Arreglado (todos pasan AA) |
| 21 | Bajo | Documentación con datos viejos (husos de los tests, `npm audit`, caché, pagos de liquidación) | Arreglado |
| 22 | Bajo | Un archivo huérfano en el bucket (de un pago TEST borrado por SQL) | Para borrar (lista abajo) |
| 23 | Bajo | Dos pestañas editando lo mismo: gana la última, sin aviso | Propuesto |
| 24 | Bajo | Editar las tarifas cambia lo pendiente de módulos anteriores | Propuesto (decisión) |
| 25 | Bajo | Una persona desactivada sigue figurando como coach de un alumno sin ninguna marca | Propuesto |
| 26 | Bajo | Mientras cargan las categorías, la sección Gastos del menú aparece vacía y después "salta" | Propuesto |
| 27 | Bajo | `PGRST303` (reloj de la máquina adelantado) se registra varias veces por día | Explicado |

## Parte 0. Pagos de liquidación (hallazgo 2) — arreglado

En un pago con `equipo_id` o `modulo_id` ahora se puede cambiar solo
`fecha_pago`, `metodo_pago`, `proveedor`, `descripcion` y el comprobante. El
servidor rechaza cambiar `monto`, `categoria_id`, `equipo_id`, `modulo_id` o
`periodo` con 409 y este mensaje: "En un pago de liquidación solo se pueden
cambiar la fecha, el método, el proveedor, la descripción y el comprobante. El
monto, la categoría y la persona los define la liquidación: si están mal,
eliminá el pago (lo que pagaba vuelve a quedar pendiente) y volvé a liquidar."
(`validarEdicionPagoLiquidacion`, misma regla en la demo).

- **En vivo**: monto y categoría rechazados con ese mensaje. Fecha, método,
  proveedor y descripción (con comillas y ñ) guardados. Comprobante adjuntado,
  abierto con la URL firmada y quitado desde la ventana "Editar": el archivo
  desapareció del bucket. En la ventana, categoría y monto aparecen bloqueados,
  con una nota que explica por qué.
- **Tests**: 4 de la regla y 1 de la demo.

## Parte 1. Backend y API

### 1.1 Rutas, sesión y validación

Las 28 rutas (50 combinaciones de ruta y método):

- **Sin sesión**: 150 pedidos (sin token, con un token inventado y con un
  cuerpo roto, más ids que no son uuid y un id con SQL). Todos dieron 401, y
  ninguna respuesta tiene texto técnico.
- **Con sesión**, solo con datos inválidos o ids inexistentes (sin escribir
  nada real): 97 casos. Cuerpos rotos, arrays y `null`; tipos equivocados;
  textos de 5000 caracteres; ids que no son uuid y uuid inexistentes; fechas
  imposibles (30 de febrero, mes 13, 29 de febrero de 2026); montos negativos,
  `"abc"`, `"1,5"` y 1e12; métodos y estados inventados; comillas y caracteres
  especiales.
  - Todos responden 400, 404 o 409 con un mensaje en castellano.
  - La única excepción era `/api/errores` con un cuerpo roto (500), ya
    arreglada (hallazgo 13).
- **Ids de otra tabla**: dan 404 igual que un id inexistente, porque cada
  ruta busca en su propia tabla.

### 1.2 Concurrencia y doble envío

- **Liquidar el mismo módulo dos veces a la vez** (dos pedidos en paralelo):
  uno creó 4 pagos y el otro recibió 409 "Este módulo ya fue liquidado". Sin
  duplicados.
- **"Liquidar pendientes" dos veces seguidas**: la segunda devuelve 0.
- **Doble clic en la pantalla (hallazgo 1)**: tres clics seguidos en
  "Registrar pago" crearon 3 pagos iguales, y en "Agregar cliente" 3 clientes.
  - Causa: `guardando` deshabilita el botón recién en el próximo dibujo.
  - Arreglo: un candado inmediato (`useRef`) en las 10 ventanas que crean o
    guardan (pago, cliente, cobro, categoría, recordatorio, sesión,
    certificación, persona del equipo, inscripción y coach). La ventana de
    liquidar ya lo tenía.
  - Verificado en vivo: con el arreglo, tres clics crean un pago y un cliente.
  - Los cobros ya eran seguros, porque la cuota se guarda con upsert por
    persona y mes.
- **Propuesta (hallazgo 23)**: dos pestañas editando lo mismo terminan con el
  último cambio, sin aviso. Para un solo usuario es aceptable. Si suman
  usuarios, se puede agregar una comprobación de versión (`updated_at`) en las
  ediciones.

### 1.3 Consistencia de números (en vivo)

| Dato | Inicio | Otra pantalla | Resultado |
|---|---|---|---|
| Gastado octubre | 390 | Gastos "Pagado en octubre" 390 y suma de los pagos 390 | Igual |
| Cobrado en el año | 12.799 | Suma de "Cuotas cobradas del año" de las tablas 12.799 | Igual |
| Cobrado septiembre | 2.799 (por fecha de pago) | Tabla de cuotas de septiembre 12.799 (por mes de la cuota) | Distinto a propósito |
| Liquidaciones | — | Planilla CSV, Gastos y base | Iguales |

La diferencia de septiembre es la regla pedida en la tanda 2 (el Inicio cuenta
por fecha de pago): la cuota de septiembre de 10.000 se cobró el 1 de mayo. El
rótulo de las tablas no lo explicaba; ahora dice "Cuotas de septiembre de 2026
cobradas", con la nota "Por mes de la cuota; Inicio cuenta por fecha de cobro"
(hallazgo 15).

### 1.4 Fechas

- Tests nuevos en `lib/limitesFechas.test.js`:
  - El 31 de octubre a las 23:30 de Argentina sigue siendo octubre (en UTC ya
    es noviembre), y el 1 de noviembre a las 00:10 ya es noviembre.
  - Una cuota que vence el 31 sigue en fecha el 31 a las 23:30.
  - El 29 de febrero existe en 2028 y no en 2026; un gasto que vence el 31
    vence el 29 en un febrero bisiesto y el 28 en uno común.
  - La ventana de 7 días cruza de febrero a marzo.
- Toda la suite pasa con la máquina en Argentina y con `TZ=UTC` (el huso del
  servidor).
- **Corrección importante**: en esta máquina (Windows), Node solo respeta
  `TZ=UTC`; con `Asia/Tokyo` o `Pacific/Kiritimati` sigue en la hora de
  Argentina. Las corridas "en Tokio, Los Ángeles y Kiritimati" que anotaba el
  README no se aplicaron de verdad. La lógica no depende del huso de la
  máquina (usa `Intl` con la zona fija), así que el riesgo es bajo, pero la
  documentación decía algo falso. Ya está corregida (hallazgo 21).

### 1.5 Comprobantes (en vivo)

- **Bucket**: privado, con límite de 5 MB y solo JPG, PNG, WebP y PDF. Sin URL
  firmada, el archivo devuelve 400, tanto por la ruta pública como por la
  directa.
- **URL firmada**: funciona recién creada (200) y a los 70 segundos ya no
  (400, "exp claim timestamp check failed").
- **Validación del servidor**: rechaza un PNG falso, un zip y más de 5 MB
  (probado en la tanda 2).
- **Archivos al reemplazar o borrar**: al reemplazar un comprobante se borra el
  anterior; al eliminar el pago se borra el archivo; al quitarlo desde
  "Editar", también.
- **Archivo huérfano (hallazgo 22)**: queda
  `7cb1f1ac-…/1791147963488.png`, de un pago TEST de la tanda 2 que se borró
  por SQL. Borrar un pago por SQL no borra su archivo: hay que borrarlo
  también en Storage. Propuesta: eliminar los pagos desde la app, o revisar de
  vez en cuando los archivos sin pago con
  `select name from storage.objects o where bucket_id='comprobantes' and not exists (select 1 from pagos_gasto p where p.comprobante_path = o.name);`

### 1.6 Rendimiento

| Ruta | Tiempo (local contra São Paulo) |
|---|---|
| `/api/resumen` | ~1,2 s antes del arreglo; ~0,4 s después (las certificaciones se leen en paralelo y los encuentros y sesiones con un join; hallazgo 14) |
| Jugadores, alumnos | ~0,35 s |
| Categorías, pagos, certificación, módulo, ficha | 0,5 a 0,9 s |

- **Pedidos por pantalla**: Inicio hace unas 6 lecturas a la API (resumen,
  jugadores, alumnos, categorías y dos de la certificación). Algunas se repiten
  en cada cambio, porque los contextos de Gastos y de Certificación vuelven a
  leer con cada `version`. Para un solo usuario es razonable; si molesta, se
  pueden invalidar solo los contextos afectados.
- **Carga simulada en memoria** (`lib/carga.test.js`; 200 clientes, 500
  pagos, 2400 cuotas y una certificación de 40 alumnos): todos los cálculos de
  Inicio y de la certificación tardan menos de 200 ms y los totales cierran.

## Parte 2. Base de datos (solo lectura)

### Asesores de Supabase

- **Performance**: sin avisos.
- **Seguridad**:
  - "RLS sin políticas" en `public.app_admins` y `private.emails_permitidos`:
    es intencional (el acceso se decide con `private.es_admin()`).
  - **"Leaked password protection" desactivada**: la tiene que activar el
    dueño (hallazgo 11).

### Políticas y permisos

- **RLS**: está activa en las 16 tablas de `public` y `private`. Todas las de
  datos tienen "solo admins" (`select private.es_admin()`). `errores_app`
  tiene insertar y leer para admins, y nadie puede editar ni borrar (los
  errores se acumulan; ver Parte 5).
- **Storage**: leer, subir y borrar solo admins, y solo en el bucket
  `comprobantes`. No hay política de actualización (la app no reemplaza en el
  lugar).
- **Funciones**: todas tienen `search_path` vacío.
  - Las de `private` no las puede ejecutar ni `anon` ni `authenticated`, salvo
    `es_admin`.
  - Las RPC (`calcular_*`, `liquidar_*`) son `security invoker` y solo para
    `authenticated`; las de liquidar además exigen `es_admin()`.
- **Vistas**: tienen `security_invoker = true`, así que respetan la RLS.
  `anon` conserva `SELECT` sobre las dos (y por defecto sobre las tablas),
  pero la RLS no le muestra nada.
- **Comprobado con la clave pública (anónima)**:
  - Lecturas de vistas y tablas: vacías.
  - `liquidar_pendientes`: "permission denied".
  - Insert en `errores_app`: rechazado por RLS.
  - Listado del bucket: vacío.
- **Propuesta (defensa extra, opcional)**:
  `revoke select on public.estado_modulos, public.progreso_certificacion from anon;`

**Prueba que tenés que hacer vos** (necesita otra cuenta): crear un usuario
de prueba que **no** esté en `app_admins` y que **sí** esté en
`private.emails_permitidos` (si no, el trigger no deja crearlo). Con ese
usuario:

1. Iniciar sesión en la app: tiene que ver todo vacío y que cualquier guardado
   falle con un mensaje.
2. Probar `POST /api/modulos/<id>/liquidar` con su token: tiene que dar 403 "No
   tenés permiso para hacer esto" o un error de la base, nunca crear pagos.
3. Probar `GET /api/pagos-gasto/<id>/comprobante` sobre un pago real: tiene que
   dar 404.
4. Después borrar el usuario y sacar su mail de `emails_permitidos`.

### Índices

Cubren todas las claves foráneas y las consultas de la app (`categoria_id`,
`fecha_pago`, `modulo_id`, `pago_gasto_id`, `coach_id`, `profe_id`, `mes`).
Falta uno por `fecha_pago` en las tablas de cuotas, que hoy son chicas.
Propuesta para cuando crezcan:
`create index on cuotas_jugadores (fecha_pago) where estado = 'pagado';` (y
lo mismo en `cuotas_alumnos`).

### Restricciones que faltan (hallazgo 7, propuesto)

Las tablas de la primera etapa no limitan en la base lo que la app sí valida.
Comprobado con un `select` el 5 de octubre: **ninguna fila actual** violaría
estas reglas, así que la migración se puede aplicar sin tocar datos. Para
aplicarlas con una migración nueva:

```sql
alter table jugadores
  add constraint jugadores_nombre_largo check (length(trim(nombre)) between 1 and 120),
  add constraint jugadores_monto_positivo check (monto_mensual > 0),
  add constraint jugadores_contacto_largo check (contacto is null or length(contacto) <= 300),
  add constraint jugadores_notas_largo check (notas is null or length(notas) <= 2000);
alter table alumnos
  add constraint alumnos_nombre_largo check (length(trim(nombre)) between 1 and 120),
  add constraint alumnos_monto_positivo check (monto_mensual > 0),
  add constraint alumnos_total_positivo check (monto_total is null or monto_total > 0),
  add constraint alumnos_contacto_largo check (contacto is null or length(contacto) <= 300),
  add constraint alumnos_notas_largo check (notas is null or length(notas) <= 2000);
alter table cuotas_jugadores
  add constraint cuotas_jugadores_monto check (monto >= 0 and monto <= 100000000),
  add constraint cuotas_jugadores_pago_coherente check (
    (estado = 'pagado' and fecha_pago is not null) or (estado = 'pendiente' and fecha_pago is null and metodo_pago is null));
alter table cuotas_alumnos
  add constraint cuotas_alumnos_monto check (monto >= 0 and monto <= 100000000),
  add constraint cuotas_alumnos_pago_coherente check (
    (estado = 'pagado' and fecha_pago is not null) or (estado = 'pendiente' and fecha_pago is null and metodo_pago is null));
alter table recordatorios
  add constraint recordatorios_titulo_largo check (length(trim(titulo)) between 1 and 200),
  add constraint recordatorios_nota_largo check (nota is null or length(nota) <= 2000);
```

Los nombres de columnas son los del esquema actual (verificados). Si pasa
tiempo hasta aplicarla, conviene repetir el `select` de control.

### Repo frente a la base

Las 12 migraciones del repo son **idénticas byte a byte** a las aplicadas (md5
de cada una). Coinciden también los 8 triggers, las 18 políticas y las
columnas de `errores_app`. No hay cambios hechos por fuera de las migraciones.

## Parte 3. Reglas del negocio (en vivo, con datos TEST)

| Regla o flujo | Resultado |
|---|---|
| Tarifas fijas por certificación | Se aplican: sesión 50, encuentro 40, práctica 60 |
| Tarifa especial de invitado | El encuentro con 100 se paga 100 |
| 4 encuentros por módulo | Se crean solos; quitar uno regular devuelve "Los 4 encuentros del módulo no se pueden quitar." |
| Prácticas finales solo en 9 y 10, máximo 5 | Mensajes de la base (tanda 3) |
| Una sesión por alumno y módulo | 10 sesiones al inscribir; único en la base |
| 10 sesiones para certificar | TEST Alumno 1 con 10 de 10 queda "En condiciones" y aparece "Listo para certificar" en Para hacer hoy |
| Cambio de coach | Solo pasan las sesiones no hechas ni pagadas (tanda 3) |
| Pago al cerrar cada módulo y nada pagado dos veces | Liquidación en paralelo sin duplicados; "Liquidar pendientes" dos veces da 0 |
| Liquidar con tarifas faltantes | 400 "Falta definir la tarifa de la certificación antes de liquidar" (módulo y pendientes) |
| Módulo sin nada para pagar | Ver hallazgo 3 |
| Coach desactivado con pagos pendientes | Se le liquida igual (50); no aparece para asignar y conserva su historial |
| Alumno inscripto a mitad | Recibe las 10 sesiones, incluidas las de módulos ya liquidados; lo que hace de esos módulos queda como pendiente tardío |
| Editar tarifas con pagos hechos | Lo pagado no cambia (50); lo pendiente toma la tarifa nueva (70) |
| Borrar persona con historial | "Esta persona tiene historial… Desactivala…" |
| Varias certificaciones | El selector aparece y recuerda la elegida al recargar |

### Hallazgo 3 (medio, propuesto)

La pantalla solo deja liquidar un módulo **listo** (con todos sus encuentros
dictados). La API y la base, en cambio, permiten liquidar cualquier módulo
abierto. Probado: liquidar el módulo 2, sin nada dictado, devolvió "0 pagos" y
**lo cerró**; lo que se haga después en ese módulo queda como pendiente
tardío.

Hay además un hueco del negocio. Si un encuentro regular se cancela (no se
dicta nunca), el módulo jamás queda listo y desde la pantalla no se puede
liquidar. Propuesta, a decidir por vos:

- (a) Un estado "cancelado" para el encuentro: cuenta como resuelto y no se
  paga.
- (b) Permitir liquidar un módulo no listo desde la pantalla, con una
  confirmación explícita.
- En los dos casos, que la ruta `/liquidar` exija "listo" (o la confirmación),
  para que la API y la pantalla digan lo mismo.

### Hallazgo 24 (bajo, decisión)

Con tarifas "fijas definidas al inicio", si se editan después, lo pendiente
de **módulos anteriores** se paga con la tarifa nueva: probado, una sesión
del módulo 1 se pagó a 70 cuando el resto del módulo se pagó a 50. La ventana
lo avisa ("las nuevas valen para lo que todavía no se liquidó"). Opciones:

- Dejarlo así.
- Bloquear la edición de tarifas cuando ya hay pagos.
- Guardar la tarifa en cada ítem al marcarlo hecho.

## Parte 4. Experiencia de uso

### 4.1 Recorrido como la administradora

En la app real, en `/demo` y en el login se recorrieron:

- Inicio, cobros, gastos, certificación (resumen, módulos, planilla, avance,
  fichas), equipo, el registro de errores, Ctrl+K y "+ Nuevo".
- Las exportaciones, con el contenido real de cada CSV leído.
- La impresión, emulada en `/demo`, que usa los mismos componentes.

Lo que se encontró y arregló:

- **Impresión (hallazgo 6)**: en las tablas de Jugadores, Alumnos y Gastos el
  título, los montos, las fechas, los métodos y las categorías salían en color
  claro sobre papel blanco, casi invisibles. Esto ya pasaba antes de esta
  tanda. Ahora todo sale en negro, sin lápices de editar, y una fecha vacía no
  imprime "dd/mm/aaaa". También se cambió la fecha ISO del pie por dd/mm/aaaa.
- **Registro de errores (hallazgo 16)**: "08:53" eran las 20:53. Ahora se
  muestra en 24 horas.
- **Tablas de cuotas (hallazgo 15)**: rótulos aclarados.

Lo que se propone, sin tocar:

- **Persona desactivada como coach (hallazgo 25)**: en Avance figura igual
  que una activa ("Coach: TEST Coach D"). Sumar "(desactivada)" ayudaría a
  saber que hay que cambiarla.
- **Barra lateral al cargar (hallazgo 26)**: la sección Gastos aparece vacía
  hasta que cargan las categorías, y después la lista "empuja" el resto.
  Convendría reservar el lugar con un esqueleto.
- **Avisos con "Pago de"**: el aviso al editar dice "Se actualizó el pago de
  Pago de encuentros" (repetido); mejor "Se actualizó el pago (Pago de
  encuentros)".
- **Liquidar un módulo no listo**: el botón explica por qué está deshabilitado,
  pero no ofrece salida para un encuentro cancelado (hallazgo 3).

### 4.2 Lo que quedaba sin ver de tandas anteriores

- **Desactivar y borrar a alguien con historial**: verificado en vivo.
- **Editar tarifas desde la pantalla**: verificado en vivo, con el aviso.
- **"Listo para certificar"**: verificado en vivo con un alumno TEST con 10
  sesiones.
- **Varias certificaciones y el selector**: verificado en vivo, se recuerda
  al recargar.
- **CSV** (liquidaciones, avance, todos los gastos y cuotas de alumnos):
  contenido revisado en vivo. Las comillas se escapan bien y la planilla de
  liquidaciones incluye el pago con la descripción editada. Faltaba la
  protección contra fórmulas y los nombres de archivo perdían las tildes
  (hallazgos 12 y 17, arreglados).
  - **Hallazgo 8 (propuesto)**: el CSV usa coma como separador y punto
    decimal. El Excel con configuración de Argentina suele esperar punto y
    coma y coma decimal, y entonces muestra todo en la columna A y toma "1.5"
    como fecha. **No lo pude comprobar** porque no hay Excel acá: conviene
    abrir un CSV en la compu de la administradora. Si se ve mal, las opciones son punto
    y coma con coma decimal, o descargar un `.xlsx`.
- **Eliminar un pago con comprobante**: verificado en vivo, el archivo se
  borra.
- **Editar un pago cambiando o quitando el comprobante**: verificado en vivo
  (reemplazo por la API y quitar desde la ventana).
- **Vista de impresión**: revisada en `/demo` con la impresión emulada.

### 4.3 Celular (390 px)

En `/demo` con un celular emulado:

- El menú lateral se abre como cajón, se puede desplazar y muestra los
  desplegables de Gastos y la sección Certificación.
- La ventana de "Registrar pago" entra completa (717 px de alto) y no hay
  scroll horizontal.
- En la app real (tanda 3, con un iframe de 390 px) la planilla, el avance,
  el resumen, el equipo y el Inicio entran sin scroll horizontal.
- **No probado**: el teclado en pantalla de un celular real (cuánto tapa de
  las ventanas). Las ventanas tienen `overflow-y: auto`, así que deberían
  poder desplazarse.

### 4.4 Teclado y accesibilidad

- **Recorrido con Tab**: el foco es visible en todo (menú, flechas de los
  desplegables, buscador, "+ Nuevo", barras del gráfico, enlaces).
- **Ventanas**: el foco queda atrapado (30 Tab seguidos dentro de "Registrar
  pago" sin salir) y Escape la cierra.
- **Etiquetas**: el único campo sin etiqueta era el del comprobante
  (arreglado).
- **Contraste**: se sumaron al test los pares nuevos (alerta en la barra
  lateral, avisos y errores dentro de las ventanas, filas pagadas). Todos
  pasan AA (4,5:1).

### 4.5 Estabilidad

- Cien navegaciones seguidas en `/demo`: la memoria pasó de 14 a 16 MB, sin
  errores ni avisos en la consola.
- **No probado en vivo esta vez**: el vencimiento de la sesión. Forzarlo
  cierra la sesión de este navegador. El comportamiento (la app queda debajo
  del login y no se pierde lo cargado) está en `AuthGate` y se verificó en una
  tanda anterior.

### 4.6 `/demo`

Un recorrido por todas las pantallas no hizo ningún pedido a `/api` ni a
Supabase. Se ve igual que la app real porque usa los mismos componentes.

## Parte 5. Operación

### 5.1 Netlify

- **`netlify.toml`**: correcto (build `npm run build`, publish `.next`, Node
  24, las dos variables públicas, el plugin fijado).
- **Build desde cero**: un clon limpio (sin `.env.local`) con `npm ci` y solo
  las variables de `netlify.toml` compiló sin errores (21 páginas).
- **Encabezados** con ese build en `next start`: `/api` responde
  `Cache-Control: private, no-store` y todo el sitio `nosniff`,
  `Referrer-Policy` y `frame-ancestors 'self'`; ya no sale `X-Powered-By`.
  **Falta confirmarlo en la URL de Netlify** después del próximo deploy (el
  adaptador respeta `next.config`, pero no lo pude ver publicado).

### 5.2 Exportación completa (hallazgo 10, propuesto)

Hoy solo hay CSV por pantalla. Propuesta concreta:

- **Botón**: "Descargar copia completa" en una pantalla de Ajustes, o en
  `/errores` mientras tanto.
- **Ruta**: `GET /api/exportar`, solo con sesión de admin. Lee todas las
  tablas con paginación (jugadores, alumnos, cuotas, recordatorios,
  categorías, pagos, certificaciones, módulos, encuentros, inscripciones,
  sesiones, equipo) y devuelve **un JSON** con `{ version, generado_en,
  tablas: { nombre: [filas] } }`, fácil de volver a importar.
- **Planilla**: además, un **.xlsx** con una hoja por tabla para mirar en
  Excel (con la librería `xlsx`, unos 400 KB que solo se cargan al exportar),
  o un ZIP de CSV.
- **Comprobantes**: no entran (son archivos), pero el JSON lleva
  `comprobante_path`. Para una copia completa de los archivos, descargar el
  bucket desde Supabase.
- **Por qué**: si la cuenta de Supabase se pausa o se pierde, hoy no hay una
  copia propia de los datos. Ver también las copias de seguridad en 5.5.

### 5.3 Errores

- **Pantalla `/errores`**: muestra los últimos 100 (ahora con hora en 24
  horas); no está en el menú.
- **Si el registro falla**: no rompe nada; el pedido responde igual y el
  error se pierde. Es una decisión a propósito, para no entrar en un ciclo.
- **La tabla no se limpia** (no hay política de borrado). Propuesta: un
  borrado de lo que tenga más de 6 meses, a mano desde el SQL Editor o con
  `pg_cron`.
- **Hallazgo 27**: hay 4 errores `PGRST303 JWT issued at future`, todos del 4
  de octubre. Pasan cuando el reloj de la compu que usa la app está adelantado
  respecto de Supabase. La app reintenta sola y el usuario no lo ve. Si se
  repite en la compu de la administradora, conviene sincronizar la hora de Windows.

### 5.4 Documentación

README actualizado:

- Pagos de liquidación editables en parte.
- Encabezados y caché.
- `npm audit` al día.
- La corrección sobre los husos.

En la tanda 2 ya se habían sacado del README los riesgos que no aplican (el
registro abierto y la falta de política en `app_admins`). El CHANGELOG suma la
entrada de esta auditoría.

### 5.5 Lo que depende del dueño, no del código

1. **Supabase Auth**: activar "Leaked password protection" (Authentication ›
   Passwords). Es el único aviso de seguridad pendiente.
2. **Usuarios**: para sumar a alguien, primero su mail en
   `private.emails_permitidos` y después crearlo y anotarlo en `app_admins`.
   Revisar que la lista tenga solo a quien corresponde.
3. **URL del sitio**: confirmar en Auth › URL Configuration que la Site URL y
   las Redirect URLs sean las de Netlify (sin eso, "Olvidé mi contraseña" no
   vuelve al sitio).
4. **Plan**: en el plan gratuito el proyecto se pausa tras unos días sin uso.
   Con la clienta usándolo a diario no debería pasar, pero si se toman
   vacaciones conviene entrar cada tanto o pasar a Pro.
5. **Copias de seguridad**: el plan gratuito no tiene copias que se puedan
   restaurar a un momento dado. Hay dos caminos: pasar a Pro (backups
   diarios) o hacer una exportación propia periódica (5.2, o `pg_dump` con la
   cadena de conexión).
6. **Montos reales**: los montos de jugadores y alumnos los carga la administradora
   (la ventana ya no sugiere ninguno). Faltan los estimados de los gastos
   fijos (Wifi, Celulares, Zoom) y las tarifas reales de la certificación
   (sesión, encuentro, práctica).
7. **Netlify**: el deploy lo hacés vos. Después, mirar los encabezados de
   `/api` en la URL publicada y el tiempo de carga (la función está en Ohio y
   Supabase en São Paulo).
8. **Actualizar Next**: planificar el paso a 15 o 16 (hallazgo 9). Hay un
   informe previo en `docs/desarrollo/INFORME-NEXT-16.md`.
9. **Restricciones de la base**: si estás de acuerdo, aplicar el SQL de la
   Parte 2 con una migración (lo aplicás vos).

## Lo verificado en vivo y lo solo leído

- **En vivo con la sesión real**:
  - Parte 0 completa (API y ventana).
  - Toda la batería de validación con sesión.
  - Liquidación en paralelo y "Liquidar pendientes" dos veces.
  - Doble clic antes y después del arreglo.
  - Números de Inicio contra Gastos, las tablas y los CSV.
  - Comprobantes: subir, reemplazar, quitar, borrar, URL que vence y bucket
    privado.
  - Todos los flujos raros de la Parte 3.
  - Selector de certificaciones, editar tarifas, borrar con historial y
    contenido de los CSV.
  - Registro de errores.
- **En vivo sin sesión**:
  - 150 pedidos sin sesión.
  - Accesos anónimos a la API de Supabase.
  - `/demo` (pedidos, memoria, teclado, foco, impresión y 390 px) y el login.
  - Build limpio y encabezados con `next start`.
- **Solo leído o testeado**:
  - Un usuario logueado que no es admin (la tenés que probar vos).
  - El vencimiento de la sesión.
  - El teclado en pantalla de un celular real.
  - El CSV abierto en Excel.
  - Los encabezados en Netlify.
  - El comportamiento con 200 clientes y 500 pagos (simulado en memoria).

## Filas TEST para borrar

Orden recomendado:

1. Los pagos de liquidación (si no, el trigger que protege lo pagado impide
   borrar en cascada los encuentros y sesiones).
2. Las certificaciones (se llevan módulos, encuentros, inscripciones y
   sesiones).
3. Las personas del equipo.
4. Los alumnos y los jugadores.
5. El archivo del bucket (desde Storage).

| Tabla | Nombre | id |
|---|---|---|
| `pagos_gasto` | TEST Auditoría A · Módulo 1 · 1 sesión (US$ 50) | `6406f296-2930-42b6-ad75-284b39e78ec5` |
| `pagos_gasto` | TEST Auditoría A · Módulo 1 · 1 sesión (US$ 50) | `63204c39-9519-4f31-9369-38b234ef38cc` |
| `pagos_gasto` | TEST Auditoría A · Módulo 1 · 2 encuentros (US$ 80) | `c254b731-fae6-466a-98f1-6c0128d94621` |
| `pagos_gasto` | TEST Auditoría A · Pendientes · 1 sesión (US$ 70) | `fd02bc4b-4ca9-4453-8c06-599cc938db4f` |
| `pagos_gasto` | TEST corrección de método, con comillas ' y ñ (US$ 140, liquidación) | `7c239f61-7792-46ad-839e-4a2a4832fe84` |
| `pagos_gasto` | TEST doble clic pago (US$ 2,25) | `b414a564-0bef-41e9-9ac7-782b3934069f` |
| `pagos_gasto` | TEST doble clic pago (US$ 2,25) | `914a51fb-72f6-4a06-974d-4189b8803a20` |
| `pagos_gasto` | TEST doble clic pago (US$ 2,25) | `242f47f7-36a8-4738-a2a9-3995af428ff9` |
| `pagos_gasto` | TEST doble clic pago 2 (US$ 3,75) | `c0b97c0b-0c9d-4d23-a785-4cdea222e40c` |
| `certificaciones` | TEST Auditoría A | `ccb37901-bb2d-4512-88a8-32cea511e527` |
| `certificaciones` | TEST Auditoría B sin tarifas | `65dbced7-1a3d-4f74-b268-3877e45ed7e8` |
| `inscripciones` | TEST Alumno 1 | `b6c7330a-d204-4ea7-b5fc-ce287cb70770` |
| `inscripciones` | TEST Alumno 2 | `44fb51f7-52b7-415e-86b6-b396527c788e` |
| `inscripciones` | TEST Alumno 3 | `d9b9d110-a458-4bc4-8bdf-6427ebdcd294` |
| `equipo` | TEST Coach A | `9bfccc4b-a216-40ed-b6d3-30a5b10b5f04` |
| `equipo` | TEST Coach D (desactivada) | `916b3039-5681-43d2-9799-e9025e75b3f8` |
| `equipo` | TEST Profe B | `014bf765-92bc-4179-b198-a20988240ab0` |
| `equipo` | TEST Profe C | `ae1e640b-589d-4ded-a6e3-bd02e82c4004` |
| `alumnos` | TEST Alumno 1 | `2a5cfc2b-8cc3-4fc1-acee-32a66a7205d8` |
| `alumnos` | TEST Alumno 2 | `7cf14bd6-ab7b-4cd8-8716-9f5a9e38dbb6` |
| `alumnos` | TEST Alumno 3 | `246db8ed-deec-478a-9616-d8ac0f25211a` |
| `jugadores` | TEST Doble clic cliente | `2c68b104-39ea-49b9-bb1b-ba9b443c8edb` |
| `jugadores` | TEST Doble clic cliente | `2b82a958-6edb-445b-8f40-27f3d723c3ab` |
| `jugadores` | TEST Doble clic cliente | `e305969f-608a-4717-b87a-790dd0113867` |
| `jugadores` | TEST Doble clic cliente 2 | `3463dc4f-7cde-4b64-85cc-68b26a07aa88` |
| `storage.objects` (bucket `comprobantes`) | `7cb1f1ac-c981-4d80-9249-563e80b70fa4/1791147963488.png` (huérfano de la tanda 2) | `93b797a3-4e13-4587-95d5-b0203d0aa0ff` |

Las certificaciones se llevan en cascada sus 20 módulos, 80 encuentros, las 3
inscripciones y sus 30 sesiones. Los alumnos y jugadores TEST no tienen cuotas.
