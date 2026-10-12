# Mantener activo el proyecto gratuito de Supabase

El plan gratuito de Supabase **pausa el proyecto** después de varios días sin
actividad. Para evitarlo, el sistema se "toca" solo todos los días.

> **Esto NO reemplaza la copia de seguridad.** Mantener activa la base evita la
> pausa, pero no protege los datos si algo se pierde. La copia se baja a mano
> desde Configuración › Copia de seguridad (ver `COPIA-Y-AYUDA.md`).

## Cómo funciona

1. **`GET /api/salud`** (`app/api/salud/route.js`, `lib/salud.js`). Es la única
   ruta de la API que **no pide sesión** (todas las demás responden 401). Llama a la
   función `public.ping()` de Supabase —que devuelve `'ok'` y no toca ningún
   dato— con la clave pública que ya usa la app, y responde solo
   `{ "ok": true }` (200) o `{ "ok": false }` (503). Nunca devuelve detalles de
   errores. No se guarda en caché del navegador ni de la red, y el servidor
   recuerda el resultado unos 5 minutos para no consultar a Supabase en cada
   visita.
2. **Función programada** `netlify/functions/mantener-activo.mjs`. Una vez por día
   (`@daily`) llama a `/api/salud` de la propia web, tomando la dirección de
   `process.env.URL` (Netlify la define). No necesita ninguna otra variable. Si
   `process.env.URL` no existe, lo deja en el log y termina sin fallar.

El test `lib/rutasApi.test.js` comprueba que toda ruta exige sesión salvo
`salud`, y que `salud` no lee ninguna tabla.

## Cómo comprobar que corre cada día

1. En Netlify: **Site › Logs › Functions** (o *Functions* en el menú del sitio).
2. Abrir `mantener-activo`. Debería haber una línea por día:
   `mantener-activo: /api/salud respondió 200 ok=true`.
3. En *Functions* también aparece como función **programada** con su horario. Si no
   aparece, Netlify no la tomó: revisar que la carpeta `netlify/functions` esté en el
   repositorio y volver a publicar.
4. Probar a mano en cualquier momento: abrir `https://TU-SITIO/api/salud` en el
   navegador. Debe mostrar `{"ok":true}`.

Si la línea del log dice `no hay process.env.URL`, la función no llegó a llamar a
nadie: avisar a quien mantiene el sistema (conviene usar el monitor externo de abajo).

## Alternativa garantizada: un monitor externo gratuito

Las funciones programadas dependen de Netlify. Para no depender de una sola cosa,
conviene sumar un monitor gratuito (por ejemplo UptimeRobot, cron-job.org o
Better Stack) que abra `https://TU-SITIO/api/salud` **cada 5 o 15 minutos**. Además
de mantener activa la base, **avisa por mail si la web se cae** (la ruta responde
503 si Supabase no contesta). Configurarlo: tipo *HTTP(s)*, método GET, y alerta
si la respuesta no es 200.

## Si la base se pausa igual

1. Entrar a <https://supabase.com/dashboard>, abrir el proyecto.
2. Tocar **Restore** (restaurar proyecto) y esperar unos minutos a que vuelva.
3. Abrir `/api/salud` hasta que diga `{"ok":true}` y entrar al sistema.
4. **Recién entonces** avisarle a la administradora que ya puede usarlo.
5. Bajar una copia de seguridad ese mismo día.

Un proyecto pausado por mucho tiempo (más de 90 días) puede no poder restaurarse
desde el panel: por eso la copia de seguridad es lo importante.
