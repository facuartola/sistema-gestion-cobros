"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAcciones } from "./AccionesContext";
import { useDataProvider } from "./dataProvider";
import { indexar } from "./gastos";
import { armarNav, NAV } from "./navegacion";

const GastosContext = createContext({
  categorias: [],
  porId: new Map(),
  avisos: [],
  nav: NAV,
  cargando: true,
  error: "",
  recargar: () => {},
});

// Las categorías de gasto, compartidas por toda la app: de acá salen la barra
// lateral (la sección Gastos), el título de la página, el buscador y los
// selectores. Se vuelven a leer cuando algo cambia (`version` de las acciones:
// un pago nuevo, una categoría editada).
export function GastosProvider({ children }) {
  const provider = useDataProvider();
  const { version } = useAcciones();
  const [datos, setDatos] = useState({ categorias: [], avisos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    provider
      .listarCategoriasGasto()
      .then((r) => {
        if (!vigente) return;
        setDatos({ categorias: Array.isArray(r?.categorias) ? r.categorias : [], avisos: Array.isArray(r?.avisos) ? r.avisos : [] });
        setError("");
      })
      .catch((err) => {
        if (vigente) setError(err.message || "No se pudieron cargar los gastos.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [provider, version, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  const valor = useMemo(
    () => ({
      categorias: datos.categorias,
      porId: indexar(datos.categorias),
      avisos: datos.avisos,
      nav: armarNav(datos.categorias, datos.avisos),
      cargando,
      error,
      recargar,
    }),
    [datos, cargando, error, recargar]
  );

  return <GastosContext.Provider value={valor}>{children}</GastosContext.Provider>;
}

export function useGastos() {
  return useContext(GastosContext);
}
