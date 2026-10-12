# Barras de desplazamiento: qué había y qué se decidió

Auditoría hecha en `/demo` (Chrome, barras clásicas de Windows) a 1920×1080,
1440×800, 1280×800, 1024×800 y 390×800, en: Inicio, Cobros, Gastos,
Certificación (con la planilla del módulo), Recordatorios, Configuración (con la
copia de seguridad), Ayuda, buscador Ctrl+K, panel del cliente y las ventanas
«Pagué un gasto», «Cobré a alguien» y «Pagar al equipo». Capturas en
`docs/capturas/barras-despues-*` (las de «antes» se quitaron: mostraban una interfaz que ya no existe).

| Barra | Dónde | Causa | Decisión |
|---|---|---|---|
| Vertical y horizontal del menú lateral | `.side`, todos los anchos | El menú del usuario (`.menu-arriba`), cerrado pero invisible, quedaba **debajo** del bloque del usuario: la regla `.menu` (más abajo en el archivo) pisaba su `top: auto` y la lista se extendía fuera del menú. | **Eliminada** arreglando la causa: `.menu.menu-arriba` gana en especificidad. El menú mide `100dvh` y no tiene barras (`overflow: hidden`); las secciones van en `.side-cuerpo` (se desplaza con rueda, sin barra) y el bloque del usuario queda fijo abajo, entero; nombre y mail con puntos suspensivos (`min-width: 0`). |
| Vertical de «Para hacer» | Inicio, `.pn-hacer-cuerpo` | Lista acotada a propósito | **Sin barra visible**, sigue desplazándose (rueda, trackpad, touch, flechas, PageUp/PageDown, Inicio/Fin). Degradé al pie mientras hay más (se va al llegar al final) además del contador «N cosas». `role="region"`, `aria-label="Lista de cosas para hacer"`, `tabindex="0"`, foco visible. Componente `ZonaDesplazable`. |
| Vertical de la página | Todas | Contenido más alto que la ventana | **Se queda**, fina y con colores del tema (`scrollbar-width: thin; scrollbar-color`, token `--barra`). |
| Vertical del panel del cliente | `.panel-lateral` | Ficha más alta que la ventana (800 px) | **Necesaria**; queda con el estilo fino. |
| Vertical del buscador Ctrl+K | `.paleta-lista` | Lista larga de secciones, personas y tipos de gasto | **Necesaria**; estilo fino. |
| Vertical de las ventanas en celular | `.modal` (390 px) | Formulario más alto que la pantalla | **Necesaria**; estilo fino. |
| Horizontal de tablas | `.table-card`, `.pn-tabla-caja` (≤ 900 px) | Tabla más ancha que la pantalla | **Se deja** como respaldo (no apareció en ninguna pantalla probada); estilo fino. |
| Lista de personas, fondo de ventanas | `.persona-select-lista`, `.modal-overlay`, `.reingreso-overlay` | Listas desplegables / ventana más alta que la pantalla | **Se dejan** (solo aparecen si hace falta); estilo fino. |

Resultado: **ninguna pantalla probada tiene scroll horizontal** a ninguno de los
cinco anchos, y el bloque del usuario se ve entero (también con 800 px y con
230 px de alto, donde las secciones se desplazan por dentro sin barra).
