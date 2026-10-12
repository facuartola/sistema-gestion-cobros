# Cómo restaurar una copia de seguridad

Esto se usa **solo si hay que armar el sistema de nuevo** (por ejemplo, si el
proyecto de Supabase se perdió). Si Supabase simplemente está pausado, no se
restaura nada: se reactiva (ver `MANTENER-ACTIVO.md`).

La copia (`copia-de-datos-AAAA-MM-DD.zip`, que se baja desde **Configuración ›
Copia de seguridad**) trae el archivo `datos.json`: es la copia fiel de todos los
datos. El `.sql` que se carga en la base se genera a partir de ese archivo.

## Lo que necesitás

- El `.zip` de la copia, descomprimido (te interesa `datos.json`).
- Una cuenta de Supabase y un proyecto **nuevo y vacío**.
- Este proyecto en la compu, con Node instalado (la carpeta del sistema).
- Quien mantiene el sistema, si algún paso no sale.

## Paso a paso

1. **Crear el proyecto nuevo** en Supabase (nombre y región a gusto).
2. **Aplicar las migraciones** de la carpeta `supabase/migrations`, en orden de
   nombre (de la más vieja a la más nueva). Se pueden pegar una por una en el
   *SQL Editor* de Supabase, o usar la herramienta `supabase db push`. Esto crea
   las tablas, las reglas de seguridad, el bucket de comprobantes y algunos tipos
   de gasto de ejemplo.
3. **Recrear a los usuarios** (la copia **no** trae usuarios, contraseñas ni la lista
   de administradores, a propósito). Para cada persona que usa el sistema (la administradora y
   quien lo mantiene), en el *SQL Editor* del proyecto nuevo:

   1. Permitir su mail (el registro está cerrado a todo el que no figure acá):

      ```sql
      insert into private.emails_permitidos (email) values ('mail-de-la-persona@ejemplo.com');
      ```

      (Las migraciones ya anotan los mails de la instalación original; revisar la lista
      con `select * from private.emails_permitidos;` y dejar solo a quien corresponda.)
   2. Crear el usuario en el panel de Supabase: *Authentication › Users › Add user*,
      con ese mismo mail y una contraseña nueva (tildar "Auto Confirm User").
   3. Agregarlo a la lista de administradores. Sin este paso entra pero **no ve ningún
      dato**:

      ```sql
      insert into public.app_admins (user_id, email)
      select id, email from auth.users where email = 'mail-de-la-persona@ejemplo.com';
      ```
   4. En *Authentication › URL Configuration*, poner como Site URL la dirección del
      sitio (sin eso "Olvidé mi contraseña" no vuelve al sitio).

   Las personas que ya usaban el sistema tienen que entrar con la contraseña nueva (o
   usar "Olvidé mi contraseña").
4. **Generar el archivo SQL** con los datos. En la carpeta del proyecto:

   ```
   node scripts/restaurar-sql.js ruta/a/datos.json restaurar.sql
   ```

   Si algo está mal en `datos.json`, el script lo dice y no escribe nada.
5. **Revisar `restaurar.sql`** (se puede abrir con el Bloc de notas). Tiene
   comentarios que explican cada parte.
6. **Cargarlo** en el *SQL Editor* del proyecto nuevo (pegar todo y ejecutar), o
   con `psql`. Todo corre dentro de una **transacción**: si algo falla, no queda
   nada a medias. Al final hay un control que compara las filas cargadas contra las
   de la copia y cancela todo si no coinciden.
7. **Apuntar el sistema al proyecto nuevo**: cambiar `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (en `netlify.toml` y en `.env.local`) y volver a
   publicar. En Supabase, revisar *Authentication › URL Configuration*.
8. **Comprobantes** (fotos y PDF): no vienen en la copia. Están en *Storage ›
   comprobantes* del proyecto viejo, y `comprobantes.csv` lista cuáles son. Si el
   proyecto viejo todavía existe, se pueden bajar de ahí y subir al nuevo respetando
   el mismo nombre de archivo (el sistema los busca por ese nombre). Si no existe
   más, esos archivos se perdieron: por eso conviene guardar aparte los
   comprobantes importantes.
9. **Probar**: entrar, mirar Cobros, Gastos y Certificación, y comparar las
   cantidades con el `LEEME.txt` de la copia.

## Qué hace el script, y por qué

- **Orden de carga**: equipo, certificaciones, módulos, jugadores, alumnos, cuotas
  de jugadores, cuotas de alumnos, tipos de gasto (los grupos antes que sus
  subtipos), pagos de gastos, clases, inscripciones, sesiones y recordatorios. Cada
  tabla se carga después de aquellas de las que depende.
- **Automatismos apagados durante la carga**: la base crea sola los 10 módulos de
  una certificación, las 4 clases de un módulo y las 10 sesiones de una inscripción.
  Si no se apagaran, esos datos saldrían duplicados. El script los apaga antes de
  cargar y los vuelve a prender al final. Los vínculos entre tablas se siguen
  controlando.
- **Protección de los tipos de gasto**: la base tiene un automatismo
  (`proteger_categorias`, de la migración `proteger_tipos_de_gasto`) que impide
  borrar los tipos con clave (Pago de sesiones, Pago de encuentros), moverlos o
  desactivarlos, y limita el árbol a 3 niveles. Como la restauración borra los tipos
  de ejemplo antes de cargar los de la copia, ese automatismo la bloquearía: por eso
  el script apaga también los automatismos de `categorias_gasto` y los vuelve a
  prender al final (la protección queda activa una vez restaurado todo).
- **Tipos de gasto de ejemplo**: las migraciones siembran algunos. El script los
  borra antes de cargar los de la copia.
- **Identificadores**: se conservan los mismos ids, así que todas las relaciones
  quedan igual.
- **Textos**: comillas, tildes y saltos de línea se escriben bien; los vacíos, los sí/no
  y los números también.

## Ejemplo para revisar

En `docs/ejemplo-copia/` hay un `datos.json` con datos **inventados** y el
`restaurar.sql` que sale de él, para mirar cómo queda sin tocar datos reales.

## Qué se probó y qué no

- **Probado** con una base Postgres en memoria (PGlite, con los esquemas `auth` y
  `storage` de Supabase reemplazados por equivalentes mínimos): se aplicaron las 17
  migraciones reales (las cinco de la tanda de octubre —vistas del panorama, pagos
  atrasados, límites de datos, ping y protección de tipos de gasto— se trajeron de la
  base real al repo), se cargó el `.sql` de `docs/ejemplo-copia/` y también el de una
  base armada con certificación, módulos, clases, sesiones y un pago al equipo.
  Resultados: la carga termina bien; **cada tabla queda idéntica fila por fila** a la
  de origen; los 8 automatismos (incluido `proteger_categorias`) quedan prendidos al final; los 14 tipos de gasto de
  ejemplo se reemplazan por los de la copia; sin apagar los automatismos la carga
  falla (ahora, primero, porque `proteger_categorias` no deja borrar los tipos con clave); y si algo falla a mitad de camino no queda nada cargado.
- **No probado**: contra un proyecto real de Supabase (por ejemplo, que el usuario del
  *SQL Editor* tenga permiso para apagar los automatismos de las tablas, algo que
  debería cumplirse porque es el dueño de las tablas). Antes de depender de esto,
  conviene una restauración de práctica en un proyecto de Supabase nuevo y descartable.
