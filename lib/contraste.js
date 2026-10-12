// Contraste WCAG 2.x entre colores, para medir (no estimar a ojo) que los
// pares de la paleta lleguen a AA. Soporta #rrggbb y rgba(r, g, b, a); un
// color con transparencia se compone sobre el fondo indicado.

function parsearColor(texto) {
  const t = String(texto).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(t);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(t);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error(`Color no soportado: ${texto}`);
}

// Compone `frente` (con su alfa) sobre `fondo` (opaco).
export function componer(frente, fondo) {
  const f = parsearColor(frente);
  const b = parsearColor(fondo);
  return {
    r: Math.round(f.r * f.a + b.r * (1 - f.a)),
    g: Math.round(f.g * f.a + b.g * (1 - f.a)),
    b: Math.round(f.b * f.a + b.b * (1 - f.a)),
    a: 1,
  };
}

function canal(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia({ r, g, b }) {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

const aTexto = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

// Relación de contraste de `texto` sobre `fondo`. Los dos pueden ser
// translúcidos: el fondo se compone sobre `base` y el texto sobre el fondo.
export function contraste(texto, fondo, base = "#000000") {
  const fondoOpaco = componer(fondo, base);
  const textoOpaco = componer(texto, aTexto(fondoOpaco));
  const l1 = luminancia(textoOpaco);
  const l2 = luminancia(fondoOpaco);
  const [claro, oscuro] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}
