# Changelog

Hitos principales del proyecto. El detalle de cada iteración está en [`docs/desarrollo/HISTORIAL.md`](docs/desarrollo/HISTORIAL.md).

## 2026-10-12 · Versión pública
- Repositorio público sin claves ni datos reales; capturas tomadas del modo demo.

## 2026-10-06 · Gastos personalizables
- Árbol de tipos de gasto editable (crear, renombrar, mover, desactivar, borrar) con validaciones en API y base.
- Trigger `proteger_tipos_de_gasto` para que los tipos generados por el sistema no se puedan borrar.
- Límites de error por bloque en el Inicio: si un bloque falla, el resto de la pantalla sigue funcionando.

## 2026-10-05 · Panel de Inicio, copia de seguridad y ayuda
- Inicio con indicadores del mes, gráfico de ingresos y gastos, y comparación contra el mismo tramo del mes anterior.
- Vistas SQL para los totales mensuales (`vistas_panorama_cobros_y_gastos_mensuales`).
- Copia de seguridad descargable (.zip) y script de restauración probado con PGlite.
- Endpoint `/api/salud` y función programada de Netlify para mantener activa la base.
- Límites de datos en la base (montos, fechas) además de la validación en la API.

## 2026-10-04 · Gastos y certificación
- Gastos con categorías, pagos y comprobantes adjuntos (Supabase Storage).
- Certificación por módulos: equipo de coaches, inscripciones, sesiones y pagos al equipo por módulo.
- Protección de registros ya pagados a nivel base.

## 2026-09-29 · Seguridad
- Segunda capa de RLS con lista de administradores; función `es_admin` como `security definer` en un esquema privado.
- Registro público bloqueado a nivel base.
- Método de pago en las cuotas.

## 2026-09-28 · Recordatorios y registro de errores
- Recordatorios, notas de contacto y tabla `errores_app` para registrar fallas del cliente y del servidor.

## 2026-09-14 · Primera versión
- Esquema inicial: jugadores, alumnos y sus cuotas mensuales.
- Login con Supabase Auth y rutas de API que validan la sesión.
