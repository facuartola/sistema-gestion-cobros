"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAcciones } from "./AccionesContext";
import { useDataProvider } from "./dataProvider";
import { CLAVES_NAVEGADOR } from "./navegador";


const CertificacionContext = createContext({
  certificaciones: [],
  cert: null,
  resumen: null,
  cargando: true,
  error: "",
  elegir: () => {},
  recargar: () => {},
});

function leerElegida() {
  try {
    return localStorage.getItem(CLAVES_NAVEGADOR.certificacionElegida);
  } catch {
    return null;
  }
}

// La certificación elegida y su resumen (módulos, avance, pendientes, equipo y
// alumnos), compartidos por las pantallas de Certificación, el buscador y la
// ventana "Marcar sesión realizada". Con varias certificaciones, la elegida se
// recuerda en el navegador; si no hay ninguna elegida, la última en curso. Se
// vuelve a leer cuando algo cambia (`version` de las acciones).
//   persistir: false en /demo (no escribe nada en el navegador).
export function CertificacionProvider({ persistir = true, children }) {
  const provider = useDataProvider();
  const { version } = useAcciones();
  const [certificaciones, setCertificaciones] = useState([]);
  const [elegidaId, setElegidaId] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (persistir) setElegidaId(leerElegida());
  }, [persistir]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const lista = await provider.listarCertificaciones();
        if (!vigente) return;
        setCertificaciones(lista);
        const enCurso = lista.filter((c) => c.estado === "en_curso");
        const id = lista.some((c) => c.id === elegidaId) ? elegidaId : (enCurso.at(-1) ?? lista.at(-1))?.id ?? null;
        const datos = id ? await provider.obtenerCertificacion(id) : null;
        if (!vigente) return;
        setResumen(datos);
        setError("");
      } catch (err) {
        if (vigente) setError(err.message || "No se pudo cargar la certificación.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [provider, version, elegidaId, intento]);

  const elegir = useCallback(
    (id) => {
      setElegidaId(id);
      if (!persistir) return;
      try {
        localStorage.setItem(CLAVES_NAVEGADOR.certificacionElegida, id);
      } catch {
        // Sin localStorage la elección dura mientras la app siga abierta.
      }
    },
    [persistir]
  );
  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  const valor = useMemo(
    () => ({ certificaciones, cert: resumen?.certificacion ?? null, resumen, cargando, error, elegir, recargar }),
    [certificaciones, resumen, cargando, error, elegir, recargar]
  );
  return <CertificacionContext.Provider value={valor}>{children}</CertificacionContext.Provider>;
}

export function useCertificacion() {
  return useContext(CertificacionContext);
}
