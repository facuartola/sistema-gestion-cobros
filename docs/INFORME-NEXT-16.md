# Informe: evaluación de Next 16 + React 19

Hecho en la rama `next-16-evaluacion` (commit `9543b31` + el fix de esta
pasada), sin mergear a `main`. Reemplaza la referencia rota que tenía el
README ("el informe al final de CHANGELOG.md", que nunca se había escrito).

## Versiones

| Paquete | Antes (`main`) | Después (`next-16-evaluacion`) |
|---|---|---|
| `next` | 14.2.35 | 16.3.6 (con Turbopack para el build) |
| `react` / `react-dom` | 18.3.1 | 19.3.0 |

Solo cambiaron `package.json` y `package-lock.json`. Ningún código de la app
se tocó al actualizar (eso llegó después, ver "Qué se rompió").

## Qué se rompió y cómo se resolvió

**Sí se rompió algo real: `params` en las rutas API dinámicas.** Desde
Next 15, `params` en un Route Handler (`app/api/.../[id]/route.js`) pasó a
ser una `Promise` en vez de un objeto plano. El código de esta app seguía
haciendo `const { id } = params;` sin `await`, en 5 archivos:

- `app/api/jugadores/[id]/route.js`
- `app/api/jugadores/[id]/cuotas/route.js`
- `app/api/alumnos/[id]/route.js`
- `app/api/alumnos/[id]/cuotas/route.js`
- `app/api/recordatorios/[id]/route.js`

Con `id` quedando `undefined`, cualquier PATCH/DELETE/POST de cuotas contra
esas rutas fallaba. **No lo detectan ni el build ni el typecheck** (el
proyecto es JS, no TS, así que no hay error de compilación) — lo encontré
recién al probar "marcar como pagado" en el navegador, con un error real de
Postgres: `null value in column "jugador_id" of relation "cuotas_jugadores"
violates not-null constraint`.

Fix aplicado: cambiar las 5 ocurrencias a `const { id } = await params;`.
Después del fix, marcar/desmarcar un pago, editar y dar de baja funcionaron
correctamente en el navegador (ver detalle abajo). `npm test` y `next build`
siguieron pasando igual antes y después del fix (no lo detectaban).

**Aviso "JWT issued at future" — no es de Next 16. CORRECCIÓN (2026-09-29):
la explicación que se escribió acá el 2026-09-28 estaba equivocada.**

Lo que se había concluido: "el reloj de la máquina está bien y el servidor
de Auth de Supabase emite los tokens ~38 s adelantados". Las dos mitades
estaban mal:

1. **El reloj de la máquina de desarrollo está atrasado ~40-55 s.** El
   2026-09-28 se comparó contra la cabecera `Date` de Google y dio 42 s de
   diferencia, que se descartó como "latencia de red". Eso fue un error:
   esa cabecera tiene resolución de 1 s y el pedido tarda menos de 1 s. El
   2026-09-29 se midió de nuevo contra tres fuentes independientes que
   coinciden entre sí al segundo (Google, el gateway de Auth y el de REST
   de Supabase, más `now()` de la base): la máquina iba 55 s atrás.
2. **Por lo tanto, los "38 s de adelanto" del `iat` eran el atraso del
   reloj local, no un problema de Supabase.** El `iat` estaba bien.
3. **Sigue siendo cierto que no tiene relación con Next 16/React 19**: se
   reprodujo con `@supabase/supabase-js` aislado, y ese paquete es idéntico
   en las dos ramas.
4. **Lo que no se pudo cerrar**: el 2026-09-29 PostgREST igual rechazó un
   pedido real con `PGRST303 JWT issued at future` (quedó registrado en
   `errores_app`, que desde ahora sí registra estos errores), y el mismo
   pedido funcionó un minuto después con el mismo token. Con el reloj local
   atrasado el cliente no debería poder producir eso — el token lo valida
   el servidor contra su propio reloj —, así que el mecanismo exacto queda
   **sin confirmar**. Mitigación aplicada en la app: el backend responde
   503 "reintentable" ante PGRST303 y `apiFetch` reintenta dos veces
   (1,5 s y 4 s); PostgREST rechaza antes de ejecutar nada, así que
   reintentar no puede duplicar un alta.
5. **Acción recomendada**: sincronizar el reloj de Windows de esta máquina
   (Configuración → Hora e idioma → "Sincronizar ahora", o `w32tm /resync`
   como administrador) y, si en producción `errores_app` sigue mostrando
   PGRST303, reportarlo a Supabase con esos timestamps.

## Resultado de tests, build y audit

- `npm install`: sin conflictos de versiones.
- `npm test`: **36/36 tests pasan**, antes y después del fix de `params`
  (los tests no cubren las rutas API, por eso no lo detectaron).
- `npm run build` (`next build`, ahora con Turbopack): **compila y tipa sin
  errores**, mismas 16 rutas que en `main` (13 estáticas + 3 dinámicas
  agrupadas). Ni el build ni el paso de "Linting and checking validity of
  types" señalaron el problema de `params`.
- `npm audit`: **0 vulnerabilidades** (en `main` quedaban 1 crítica + 1 alta,
  ambas del rango de versiones de `next` 14).

## Qué se probó en el navegador (verificado ahora) vs. qué solo se leyó

**Verificado en vivo, con datos `TEST` creados y borrados de verdad al
terminar (no se tocaron los registros `juanjo` ni `facu`):**
- Login real con `dev@ejemplo.com`.
- Dashboard (`/`): carga el resumen del mes con datos reales.
- `/jugadores`: alta de "TEST Jugador Next16" (modal con foco atrapado),
  aviso de éxito, atraso calculado, "debe 1 mes".
- Marcar una cuota como pagada → **falló con el bug de `params` de arriba**,
  se corrigió el código, se reintentó y funcionó (toast "Se marcó ... como
  pagado" con Deshacer).
- Desmarcar el pago → pidió confirmación nativa (`window.confirm`), se
  confirmó, y funcionó (toast "Se deshizo el pago" con Deshacer).
- `/alumnos`: carga con el registro real `facu` (no se editó ni se dio de
  baja), progreso "Abonado" con barra visible.
- `/recordatorios`: formulario, sugeridos calculados al vuelo (apareció la
  sugerencia de cobro para el jugador TEST recién creado).
- `/errores`: carga vacía ("No hay errores registrados"). Coherente con el
  diseño: el 500 de `params` se devolvió como respuesta de error explícita
  (`{ error: error.message }`), no como excepción no controlada, así que no
  lo capturó `registrarErrorServidor.js` (que solo envuelve fallos no
  contemplados) — comportamiento esperado, no un bug nuevo.
- `/reset-password`: la página renderiza sola, sin el sidebar de la app
  alrededor (igual que en `main`).
- Borrado real (DELETE) del jugador TEST vía la API, confirmando que la
  lista de jugadores quedó vacía después.

**Solo leído o no verificado en esta pasada:**
- El flujo completo de "olvidé mi contraseña" de punta a punta (que llegue
  el mail y que el link funcione) — no se disparó un envío real de correo.
- La vista imprimible (`window.print()`) — no se invocó para evitar bloquear
  el navegador automatizado con el diálogo nativo de impresión (mismo motivo
  por el que hubo que resolver a mano el diálogo de `window.confirm` durante
  esta prueba); el CSS de impresión (`.print-area`, `@media print`) no
  cambió respecto a `main`, así que el riesgo de que Next 16 lo afecte es
  bajo, pero no quedó confirmado con los ojos.
- Botón "Recordar" (WhatsApp/`mailto:`) — no se hizo click para no abrir una
  ventana externa real.
- Exportar CSV — no se probó la descarga en esta pasada.
- El origen exacto del aviso "JWT issued at future" (ver arriba).

## Recomendación

**Migrar a Next 16 después del deploy inicial en Next 14.2.x, no antes ni
en el mismo momento.**

Motivo: el upgrade en sí es viable — resuelve los 2 avisos de `npm audit`
que quedan hoy, el build y los tests pasan, y el único problema real
encontrado (`params` sin `await` en las rutas dinámicas) ya está
identificado, es mecánico y acotado a 5 archivos. Pero:

1. El deploy inicial todavía no se hizo (según el checklist del README) y
   mezclar "primer deploy a producción" con "mayor de framework" complica
   innecesariamente el diagnóstico si algo falla en producción.
2. El bug de `params` demuestra que este proyecto (JS, sin TypeScript
   estricto) no tiene red de seguridad automática para este tipo de breaking
   change — build y tests verdes no garantizan que las rutas API funcionen.
   Cualquier migración de Next necesita, como mínimo, repetir a mano el
   recorrido de "marcar pago / editar / dar de baja / recordatorios" en
   navegador real antes de confiar en ella.
3. El aviso "JWT issued at future" quedó sin explicar; antes de llevarlo a
   producción conviene entenderlo, no solo constatar que "no bloqueó nada"
   en una prueba corta.

Una vez que la app esté un tiempo estable en producción con Next 14.2.x,
migrar aplicando el mismo fix de `params` (ya resuelto acá) y repitiendo
este mismo recorrido de navegador contra la base real.
