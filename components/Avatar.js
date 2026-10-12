import { colorAvatar, iniciales } from "../lib/resumen";

// Círculo con las iniciales de una persona (o un símbolo). El color sale del
// nombre, así que una misma persona siempre tiene el mismo.
export default function Avatar({ nombre, children, color }) {
  return (
    <div className="av" style={{ background: color || colorAvatar(nombre) }} aria-hidden="true">
      {children ?? iniciales(nombre)}
    </div>
  );
}
