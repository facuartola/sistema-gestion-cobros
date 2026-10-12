// Árbol de navegación de la barra lateral. Un solo lugar: lo leen la barra
// lateral, el título de la barra superior y el buscador (Ctrl+K).
//
// Tipos de nodo:
//   - { id, etiqueta, href }                   enlace.
//   - { id, etiqueta, hijos: [...] }           desplegable (hasta 3 niveles).
//   - { id, etiqueta, seccion: true, items }   rótulo de sección con sus nodos.
// `contador: "recordatorios"` pide el numerito de pendientes de esa clave.
//
// Un enlace con `exacto: true` solo está activo en su ruta, no en las que
// cuelgan de ella. Un nodo con `href` e `hijos` es un enlace que además se
// despliega (los grupos de Gastos). `aviso: { tono, texto }` pinta el indicador
// de vencimiento.
//
// NAV es lo fijo. La sección Gastos sale de la base (categorías editables):
// `armarNav` la intercala.
import { armarArbol } from "./gastos";
import { fechaCorta } from "./resumen";

export const NAV = [
  { id: "inicio", etiqueta: "Inicio", href: "/" },
  {
    id: "cobros",
    etiqueta: "Cobros",
    seccion: true,
    items: [
      { id: "cobros-pantalla", etiqueta: "Cobros", href: "/cobros" },
    ],
  },
  {
    id: "certificacion",
    etiqueta: "Certificación",
    seccion: true,
    items: [
      { id: "cert-pantalla", etiqueta: "Certificación", href: "/certificacion" },
    ],
  },
  {
    id: "agenda",
    etiqueta: "Agenda",
    seccion: true,
    items: [{ id: "recordatorios", etiqueta: "Recordatorios", href: "/recordatorios", contador: "recordatorios" }],
  },
];

// Menú lateral: cinco entradas. Cada una agrupa varias pantallas: `rutas` son
// las que la dejan marcada como activa (las subpantallas marcan a su entrada
// madre). `aviso` lo suma la barra lateral desde los vencimientos de gastos.
export const NAV_MENU = [
  { id: "inicio", etiqueta: "Inicio", href: "/", exacto: true },
  { id: "cobros", etiqueta: "Cobros", href: "/cobros", rutas: ["/cobros", "/jugadores", "/alumnos"] },
  { id: "gastos", etiqueta: "Gastos", href: "/gastos", rutas: ["/gastos"] },
  { id: "certificacion", etiqueta: "Certificación", href: "/certificacion", rutas: ["/certificacion"] },
  { id: "recordatorios", etiqueta: "Recordatorios", href: "/recordatorios", rutas: ["/recordatorios"], contador: "recordatorios" },
];

// ¿Esta entrada del menú es la de la ruta actual?
export function entradaActiva(entrada, ruta) {
  if (!ruta) return false;
  return (entrada.rutas || [entrada.href]).some((r) => esActivo(r, ruta, entrada.exacto));
}

// Páginas que no están en la barra lateral pero tienen título.
const TITULOS_EXTRA = { "/errores": "Errores del sistema", "/configuracion": "Configuración", "/ayuda": "Ayuda", "/gastos/categorias": "Mis gastos" };

function hijosDe(nodo) {
  return nodo.seccion ? nodo.items : nodo.hijos || [];
}

// Todos los enlaces del árbol, en orden, con el rótulo de su sección y, si
// están dentro de un desplegable, el camino hasta ellos ("Gastos variables ›
// Equipo de marketing").
export function aplanarEnlaces(nav = NAV) {
  const salida = [];
  function recorrer(nodos, grupo, camino) {
    for (const n of nodos) {
      if (n.href) salida.push({ id: n.id, etiqueta: n.etiqueta, href: n.href, exacto: Boolean(n.exacto), grupo, camino: camino.join(" › ") });
      const hijos = hijosDe(n);
      if (hijos.length) recorrer(hijos, n.seccion ? n.etiqueta : grupo, n.seccion ? camino : [...camino, n.etiqueta]);
    }
  }
  recorrer(nav, null, []);
  return salida;
}

// "/" solo es activo en "/"; el resto, en su ruta y las que cuelgan de ella
// (salvo que sea `exacto`).
export function esActivo(href, ruta, exacto = false) {
  if (!ruta) return false;
  if (href === "/" || exacto) return ruta === href;
  return ruta === href || ruta.startsWith(`${href}/`);
}

export function tituloDe(ruta, nav = NAV) {
  const enlace = aplanarEnlaces(nav).find((e) => esActivo(e.href, ruta, e.exacto) && e.href !== "/");
  if (enlace) return enlace.etiqueta;
  if (ruta === "/") return "Inicio";
  const extra = Object.keys(TITULOS_EXTRA).find((k) => esActivo(k, ruta));
  return extra ? TITULOS_EXTRA[extra] : "Contabilidad";
}

// Ids de los desplegables que contienen la ruta activa: se abren solos para
// que el ítem activo nunca quede escondido.
export function ancestrosDe(ruta, nav = NAV) {
  const camino = [];
  function buscar(nodos) {
    for (const n of nodos) {
      if (n.href && esActivo(n.href, ruta, n.exacto) && (n.href !== "/" || ruta === "/")) return true;
      const hijos = hijosDe(n);
      if (hijos.length) {
        const antes = camino.length;
        if (!n.seccion) camino.push(n.id);
        if (buscar(hijos)) return true;
        camino.length = antes;
      }
    }
    return false;
  }
  buscar(nav);
  return camino;
}

// Niveles de la rama más profunda: Gastos variables > Equipo de marketing >
// Consultora son 3. Una sección es solo un rótulo y no cuenta como nivel.
export function profundidad(nav = NAV) {
  function nivel(nodos) {
    let max = 0;
    for (const n of nodos) {
      const hijos = hijosDe(n);
      max = Math.max(max, n.seccion ? nivel(hijos) : 1 + nivel(hijos));
    }
    return max;
  }
  return nivel(nav);
}

// --- Sección Gastos, armada con las categorías de la base --------------------

function textoAviso(a) {
  return `${a.nombre} ${a.estado === "vencido" ? "venció" : "vence"} el ${fechaCorta(a.vencimiento)}`;
}

// Nodos de Gastos: un enlace por categoría activa (los grupos además se
// despliegan), con el indicador de vencimiento. Un grupo muestra el de sus
// subcategorías: rojo-ámbar si alguna está vencida, dorado si solo vencen pronto.
export function nodosDeGastos(categorias, avisos = []) {
  const porCategoria = new Map();
  for (const a of avisos) {
    if (!porCategoria.has(a.id)) porCategoria.set(a.id, []);
    porCategoria.get(a.id).push(a);
  }
  function nodo(c) {
    const hijos = c.hijos.map(nodo);
    const propios = porCategoria.get(c.id) || [];
    const todos = [...propios, ...hijos.flatMap((h) => h.avisos)];
    const base = {
      id: `gasto-${c.id}`,
      etiqueta: c.nombre,
      href: `/gastos/${c.id}`,
      avisos: todos,
      aviso: todos.length
        ? { tono: todos.some((a) => a.estado === "vencido") ? "vencido" : "proximo", texto: todos.map(textoAviso).join(". ") }
        : null,
    };
    return hijos.length ? { ...base, hijos } : base;
  }
  return armarArbol(categorias, { soloActivas: true }).map(nodo);
}

// NAV con la sección Gastos intercalada después de Cobros.
export function armarNav(categorias = [], avisos = []) {
  const gastos = {
    id: "gastos",
    etiqueta: "Gastos",
    seccion: true,
    items: [
      { id: "gastos-inicio", etiqueta: "Gastos", href: "/gastos", exacto: true },
      { id: "gastos-todos", etiqueta: "Todos los pagos", href: "/gastos/pagos", exacto: true },
      ...nodosDeGastos(categorias, avisos),
      { id: "gastos-categorias", etiqueta: "Mis gastos", href: "/gastos/mis-gastos", exacto: true },
    ],
  };
  const i = NAV.findIndex((n) => n.id === "cobros");
  return [...NAV.slice(0, i + 1), gastos, ...NAV.slice(i + 1)];
}

// Normaliza para buscar: sin tildes ni mayúsculas.
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
