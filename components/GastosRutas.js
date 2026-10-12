"use client";

import { useNavegacion } from "../lib/NavContext";
import MisGastos from "./MisGastos";
import GastosInicio from "./GastosInicio";
import GastosPagina from "./GastosPagina";

// Las páginas de Gastos según la ruta: /gastos (los tipos de gasto), /gastos/pagos (todos los pagos),
// /gastos/mis-gastos (armar la lista de gastos; /gastos/categorias, la dirección vieja, sigue
// respondiendo lo mismo) y /gastos/<id> (un tipo de gasto). Lee la ruta
// del contexto de navegación y no de Next, así funciona igual en /demo, donde
// cambiar de página no es una navegación de verdad.
export default function GastosRutas() {
  const { ruta } = useNavegacion();
  const [, segmento] = ruta.split("/").filter(Boolean);
  if (!segmento) return <GastosInicio />;
  if (segmento === "pagos") return <GastosPagina key="todos" categoriaId={null} />;
  if (segmento === "mis-gastos" || segmento === "categorias") return <MisGastos />;
  return <GastosPagina key={segmento} categoriaId={segmento} />;
}
