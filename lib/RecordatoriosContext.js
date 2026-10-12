"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useDataProvider } from "./dataProvider";
import { hoyArgentinaISO } from "./fechas";
import { agruparRecordatorios } from "./recordatoriosAgrupar";

const RecordatoriosContext = createContext(null);

// Estado único de recordatorios para toda la app: lo consume tanto el panel
// lateral compacto como la vista completa (/recordatorios), así que crear,
// editar o completar un recordatorio desde cualquiera de los dos (o desde el
// acceso rápido de una fila de persona) se refleja en el otro sin recargar,
// porque ambos leen del mismo Context en vez de tener cada uno su propio fetch.
export function RecordatoriosProvider({ children }) {
  const provider = useDataProvider();
  const [recordatorios, setRecordatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await provider.listarRecordatorios();
      setRecordatorios(data);
    } catch (err) {
      setRecordatorios([]);
      setError(err.message || "Ocurrió un error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = useCallback(
    async (body) => {
      const nuevo = await provider.crearRecordatorio(body);
      setRecordatorios((rs) => [...rs, nuevo]);
      return nuevo;
    },
    [provider]
  );

  // Cola por recordatorio: cada cambio sale recién cuando terminó el
  // anterior del MISMO recordatorio. Sin esto, "hecho" y "deshacer" muy
  // seguidos viajaban en paralelo y el servidor podía aplicarlos en el orden
  // inverso (quedaba hecho aunque la pantalla dijera que no).
  const colas = useRef(new Map());

  const actualizar = useCallback(
    (id, cambios) => {
      const anterior = colas.current.get(id) || Promise.resolve();
      const pedido = anterior
        .catch(() => {})
        .then(() => provider.actualizarRecordatorio(id, cambios))
        .then((actualizado) => {
          setRecordatorios((rs) => rs.map((r) => (r.id === id ? actualizado : r)));
          return actualizado;
        });
      colas.current.set(id, pedido);
      pedido
        .finally(() => {
          if (colas.current.get(id) === pedido) colas.current.delete(id);
        })
        .catch(() => {});
      return pedido;
    },
    [provider]
  );

  const eliminar = useCallback(
    async (id) => {
      await provider.eliminarRecordatorio(id);
      setRecordatorios((rs) => rs.filter((r) => r.id !== id));
    },
    [provider]
  );

  // Optimista: el tilde (y que el recordatorio salga de "Vencidos/Hoy") se
  // ve al instante; si el servidor falla, se vuelve al estado anterior y el
  // error sube a quien llamó para que lo muestre.
  const toggleHecho = useCallback(
    async (r) => {
      const hecho = !r.hecho;
      setRecordatorios((rs) =>
        rs.map((x) => (x.id === r.id ? { ...x, hecho, hecho_en: hecho ? new Date().toISOString() : null } : x))
      );
      try {
        return await actualizar(r.id, { hecho });
      } catch (err) {
        setRecordatorios((rs) => rs.map((x) => (x.id === r.id ? r : x)));
        throw err;
      }
    },
    [actualizar]
  );

  const hoy = hoyArgentinaISO();
  const grupos = agruparRecordatorios(recordatorios, hoy);
  const urgentes = grupos.vencidos.length + grupos.hoy.length;

  const value = {
    recordatorios,
    loading,
    error,
    grupos,
    urgentes,
    hoy,
    cargar,
    crear,
    actualizar,
    eliminar,
    toggleHecho,
  };

  return <RecordatoriosContext.Provider value={value}>{children}</RecordatoriosContext.Provider>;
}

export function useRecordatoriosContext() {
  const ctx = useContext(RecordatoriosContext);
  if (!ctx) {
    throw new Error("useRecordatoriosContext debe usarse dentro de <RecordatoriosProvider>");
  }
  return ctx;
}
