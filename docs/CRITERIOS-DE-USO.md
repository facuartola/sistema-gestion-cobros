# Criterios de uso: máximo de clics por tarea

Pensado para la administradora, que usa la app sin conocimientos técnicos. Cada tarea tiene un
**máximo** de clics. Cuánto se necesita hoy está en la tabla, con qué se contó y cómo se
comprobó.

## Cómo se cuenta

- Un clic es una acción de **tocar o elegir**: un botón, una opción de una lista, un archivo.
- **Escribir no cuenta** (un nombre, un monto, una fecha ya completa).
- Lo que la app **recuerda o completa sola** no cuenta (el último método de pago, el monto
  habitual de un gasto, la fecha de hoy, el mes en curso).
- Se cuenta desde la pantalla de partida que se indica y hasta el último botón que guarda.
- Una ventana que se abre sola (por ejemplo "Registrar cobro") no suma un clic.

## Tabla

| Tarea | Máximo | Hoy | Recorrido | Comprobado |
|---|---|---|---|---|
| Cobrar a alguien | 3 | 2 a 3 | Inicio › «Cobré a alguien» › elegir a la persona › «Registrar cobro» (desde «Quién debe» o «Para hacer»: «Cobré» › «Registrar cobro», 2) | Leído del código |
| Registrar un gasto fijo | 3 | 1 a 2 | Gastos › «Pagué» en la tarjeta (1 clic, usa el monto habitual y la fecha de hoy) o «Registrar pago» › «Registrar pago» (2) | Leído del código |
| Registrar un gasto variable con comprobante | 4 | 4 | Inicio › «Pagué un gasto» › elegir el tipo › elegir el archivo › «Registrar pago» | Leído del código |
| Marcar una clase | 4 | 4 | Inicio › «Registré una clase o sesión» › la clase › «Dictada» › guardar | Leído del código |
| Pagar al equipo | 4 | 3 a 4 | Certificación › «Pagar al equipo» › revisar › «Pagar» | Leído del código |
| Crear un recordatorio | 3 | 2 a 3 | Recordatorios › escribir el título › elegir el día › «Agregar» | Leído del código |
| Ver quién debe | 1 | 1 | Inicio, vista «Hoy»: el bloque «Quién debe» ya está a la vista (0 clics si «Hoy» es la vista elegida) | Verificado en /demo |
| Agregar un cliente | 3 | 3 | Cobros › «+ Agregar cliente» › elegir el tipo › «Agregar cliente» | Leído del código |
| Cambiar un monto | 3 | 3 | Cobros › tocar a la persona › «Guardar datos» | Leído del código |
| **Agregar un tipo de gasto** | **3** | **3** | Mis gastos › «Agregar un gasto» › «¿Se repite?»: «Cada mes» › «Agregar gasto» (el nombre se escribe) | **Verificado en vivo (sesión real) y en /demo** (clics contados con el script de prueba) |
| Crear un tipo mientras se registra un pago | 4 | 3 más el pago | «+ Crear un tipo nuevo» (elegido en la lista) › «Cada mes» › «Crear y seguir con el pago», y se sigue con el mismo pago | Verificado en /demo |

Las tareas "Leído del código" se midieron siguiendo los botones en el código (y en las tandas
anteriores); no se volvieron a medir con un cronómetro en esta tanda. Las dos con "Verificado
en /demo" se corrieron de punta a punta en `/demo` con clics reales y un solo registro
resultante aun con tres clics muy seguidos en el botón de guardar.

## Reglas que cuidan estos máximos

- Todo botón que guarda usa el candado de doble clic (`lib/useCandado.js`): tres clics rápidos
  guardan una sola vez.
- Los formularios piden solo lo necesario. En un tipo de gasto: nombre, carpeta, si se repite,
  monto habitual (opcional) y día de vencimiento. Nada de otras monedas, otras frecuencias,
  campos propios ni presupuestos.
- Todo en dólares. No se ven las palabras liquidar, liquidación, liquidado, pendientes,
  período, categoría, recurrencia ni "cuota actual" (`lib/vocabulario.test.js`).
- Lo que se puede deshacer no pide confirmación: avisa y ofrece «Deshacer» (por ejemplo,
  desactivar un gasto). Lo que no se puede deshacer (borrar) pide confirmar en la misma fila,
  sin ventanas del navegador.
