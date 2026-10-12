# Verificación final del código (2026-10-06)

Pasada de limpieza: no agrega funciones. Cada corrección es un commit chico, con los
503 tests y el lint pasando. Sin push ni deploy.

## Hallazgos por severidad

### Crítico
- Ninguno encontrado en el código.
- (Conocido, no nuevo) `next` 14.2.35 tiene un aviso crítico de `npm audit` sin parche
  en la rama 14; ver README «Estado de npm audit» y `docs/INFORME-NEXT-16.md`.
  **Propuesta:** planificar la actualización de Next (decisión de arquitectura, no tocada).

### Alto
- **Ninguna ruta de la API deja pasar sin sesión.** Verificado en vivo contra lo compilado:
  GET y POST sin sesión dan 401 en todas las rutas; solo `/api/salud` da 200 (`{"ok":true}`).
  Las rutas con un solo verbo (`inscripciones`, `sesiones`) dan 405 sin sesión con otro verbo.
- **Migraciones = base real.** Las 17 migraciones del repo coinciden con las 17 aplicadas
  (versión, nombre y orden). Además se compararon firmas del esquema (columnas, triggers,
  políticas, funciones, restricciones, índices y vistas): aplicando las migraciones del repo
  en una base en memoria da **hashes idénticos** a la base real.

### Medio
- **Respuesta vieja pisaba la planilla de un módulo** (`ModuloPlanilla`): si se cambiaba de
  módulo o se refrescaba con un pedido en vuelo, el último en llegar ganaba aunque fuera el
  viejo. Corregido (solo vale la última lectura).
- **Restos en el bucket `comprobantes`: 3 archivos huérfanos** (de pagos TEST de pasadas
  anteriores, ya sin fila en `pagos_gasto`). Fechas 2026-10-04, 2026-10-05 y 2026-10-06.
  No se tocaron (sin escrituras en la base): ver «Filas TEST».
- Copia y pega de lógica: etiquetas de método de pago repetidas en 9 archivos, `enDemo()`
  en 4 y claves del navegador sueltas. Corregido (ver abajo).

### Bajo
- 3 modales (`ClienteModal`, `MarcarSesionModal`, `RegistrarCobroModal`) usan un candado
  manual (`useRef` + estado) en vez de `lib/useCandado`. Es equivalente y deliberadamente
  deja el botón bloqueado tras el éxito; **no se tocó**.
- Eliminar un pago (`GastosPagina`), deshacer un cobro (`AccionesProvider`) y los cambios de
  recordatorios no usan `useCandado`. Son idempotentes (borrar, upsert) o van en cola por
  recordatorio; riesgo bajo. El resto de los sitios que crean o guardan algo sí lo usan.
- Timers sin limpieza de efecto (`Bienvenida` salida, `PersonaSelect` blur): inocuos.
- Funciones largas / complejas (ESLint estricto: `complexity` > 20 en 23 sitios,
  `max-lines-per-function` > 150 en 16, `max-lines` > 600 solo en `inicio/Bloques.js`, 701).
  Lista en «Propuestas». No se refactoriza: es riesgo de comportamiento.
- `eqeqeq`: 61 avisos, todos `== null` / `!= null` (idiom intencional para null/undefined).
- `console.*`: solo en la función programada de Netlify (log útil), el script de restauración
  y su verificación (herramientas de línea de comandos) y un `console.error` de `inicioDatos`
  (registro de un cálculo que falló). Aceptado.
- Sin `dangerouslySetInnerHTML` salvo un script constante (`PaginaLista`, captura de clics
  tempranos), sin datos de usuario. Sin `TODO`/`FIXME`/código comentado.
- Los `catch {}` que tragan están todos comentados y son de almacenamiento del navegador o
  de registro de errores (que no puede fallar la respuesta real).
- Seguridad de Supabase (advisors): solo avisos conocidos y buscados (`app_admins` y
  `private.emails_permitidos` con RLS sin políticas, a propósito) y «leaked password
  protection» desactivada (se activa en el panel; no se toca Auth).

## Qué se corrigió (commits)
1. Método de pago: `ETIQUETA_METODO` y `OPCIONES_METODO` en `lib/metodoPago.js` (−9 copias).
2. Código muerto: 36 exportaciones sin uso pasaron a internas; se borraron `conteos`,
   `textoDemasiadoLargo`, `PROFUNDIDAD_MAXIMA`, un re-export de `indexar` y 3 imports/variables sin uso.
3. `lib/navegador.js`: claves de `localStorage`/`sessionStorage` y `enDemo()` en un solo módulo.
4. Largos máximos de los formularios (`maxLength`) salen de `LIMITES`, `LIMITES_CERT` y
   `LIMITES_GASTO` en vez de números sueltos.
5. `ModuloPlanilla`: una lectura vieja ya no pisa la nueva.
6. Capturas: se quitaron 26 imágenes de «antes» (interfaz vieja); `docs/capturas` pasó de 13 MB a 9,9 MB.
7. CSS: 60 reglas y 69 selectores de clases que ningún componente usa (−365 líneas).
8. README (17 migraciones, `npm ci`, comandos) y `package.json` (`engines`).

## Métricas
| | Antes | Después |
|---|---|---|
| Duplicados (jscpd, ≥50 tokens, sin tests) | 59 clones, 532 líneas (2,30 %) | 58 clones, 525 líneas (2,31 %) |
| Exportaciones sin uso (knip) | 36 | 0 |
| Archivos sin uso (knip) | 2 (los scripts de línea de comandos, intencionales) | 2 (igual) |
| Dependencias / devDependencias sin uso | 0 | 0 |
| Clases CSS sin ninguna mención | 51 (14 de ellas se arman con plantillas, se mantienen) | 0 reales; `globals.css` 5348 → 4983 líneas |
| Tests | 503 (41 archivos) | 503 (41 archivos) |
| Lint (`next lint`) | limpio | limpio |
| Tamaño de rutas (First Load JS) | `/` 193 kB, `/cobros` 181, `/gastos` 185, `/certificacion` 188, `/demo` 257 | sin cambios apreciables (ver `next build`) |

El porcentaje de duplicados casi no se movió porque lo repetido que queda es el esqueleto
de las rutas de la API (autenticación → lectura del cuerpo → validación → consulta → error →
respuesta), que es el mismo orden en todas a propósito.

## Propuestas (no tocadas: decisión de arquitectura)
- Un envoltorio `conSesion(handler)` para las ~35 rutas que repiten
  `supabaseForRequest` + `exigirSesion` + `conRegistroDeErrores` (quita la mayor parte de
  los duplicados restantes; toca todas las rutas).
- Partir las pantallas más largas: `ModuloPlanilla` (361 líneas), `PagoGastoModal` (325,
  complejidad 50), `PanelCliente` (307), `CobrosPagina` (297), `GastosPagina` (267),
  `AuthGate` (277), `crearCertificacionDemo` (325) y `inicio/Bloques.js` (701 líneas).
- Actualizar a Next 16 (ver `docs/INFORME-NEXT-16.md`) para cerrar el aviso crítico.
- Paginación en listados (hoy sin límite; el volumen esperado son decenas de personas).
- Capturas `despues-*.jpg` y `despues2-*` muestran la interfaz de pasadas anteriores
  (con datos TEST o demo): se pueden borrar si ya no hacen falta.
- Activar «leaked password protection» en el panel de Supabase.

## Vocabulario, fechas, dinero
- Barrido de palabras prohibidas: el test `vocabulario.test.js` (app, components, lib) pasa;
  los mensajes de la base con «liquidado/liquidar/categorías» se traducen en `lib/mensajesApi.js`
  (3 mensajes, cubren todos los `raise exception` de las migraciones con esas palabras).
- Fechas de negocio: todas pasan por `lib/fechas`; los `new Date()`/`toISOString()` que quedan
  son instantes (`created_at`, `hecho_en`, `generado_en`, última copia) o cálculo de calendario UTC.
  Los `toFixed` son coordenadas de gráficos SVG.

## Datos reales, secretos e higiene
- Mails en el árbol: solo los dos autorizados (migración de registro, `lib/bienvenida.js`, sus
  tests y el CHANGELOG) —**configuración legítima, solo marcada**— y direcciones `@ejemplo.*`.
  Teléfonos: solo ejemplos inventados. Nombres en demos y docs: inventados o TEST.
- Capturas: las revisadas (3) muestran datos de `/demo` o con prefijo TEST. **No se miraron
  las 66 restantes una por una.**
- Historial de git: contiene únicamente los dos mails autorizados; nunca se commiteó
  `.env.local`, ni `service_role`, ni claves secretas. Sin reescribir.
- Secretos: la única clave en el repo es la `anon` (rol decodificado: `anon`) en `netlify.toml`
  y `.env.local.example`; `.env.local` está ignorado y no rastreado.
- `npm audit`: 6 avisos (1 crítico: `next` 14.2.35; 5 altos: `postcss`, `source-map-js`,
  `glob`, `@next/eslint-plugin-next`, `eslint-config-next`); todos se arreglan solo subiendo
  de versión mayor (`next@16`). Sin cambios respecto de lo ya documentado.

## Base de datos (solo lectura)
- Tablas de negocio en 0; `categorias_gasto` 14; `auth.users` 2; `app_admins` 2.
- Los 14 tipos de gasto son los de la migración de siembra (incluye «Mantenimiento» con
  monto estimado 100: es el valor de la semilla, no un dato de prueba).
- `scripts/restaurar-sql.js` conoce las 13 tablas de negocio (`ORDEN`); se repitió el test
  de ida y vuelta: todas las tablas idénticas fila por fila, 8 triggers activos al final,
  el control negativo falla como debe y un fallo a mitad deja todo como estaba.
  `docs/RESTAURAR.md` sigue siendo correcto.

## Verificado en vivo y solo leído
**En vivo:** estado de la base; 401 en todas las rutas sin sesión; build y `next start`;
comparación de esquemas; test de restauración (PGlite); tests, lint, knip, jscpd, ESLint estricto.
**Solo leído:** capturas (3 de 69), historial de git, lo no ejecutado de la app con sesión
(ver sección siguiente).

## Recorrido con sesión real
(pendiente: ver más abajo si se completó)

## Filas TEST
Ninguna creada en esta pasada hasta ahora. Restos de pasadas anteriores en el bucket:
`comprobantes/7cb1f1ac-c981-4d80-9249-563e80b70fa4/1791147963488.png`,
`comprobantes/f917ea6e-e8e8-4bf2-a333-8a1e1a9ea5ef/1791215178040.png`,
`comprobantes/2f6b467d-4f8b-403b-ba99-194c85bed0c5/1791253510859.png` (storage.objects).
