"use client";

import { useEffect, useState } from "react";
import { filtrarTareas } from "../lib/ayuda";
import Enlace from "./Enlace";

// "¿Cómo hago…?": tareas comunes con sus pasos. Se imprime en una hoja (al
// imprimir se abren todas) para dejársela a la administradora.
export default function AyudaPagina() {
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [imprimiendo, setImprimiendo] = useState(false);
  const visibles = filtrarTareas(busqueda);

  useEffect(() => {
    const antes = () => setImprimiendo(true);
    const despues = () => setImprimiendo(false);
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", despues);
    };
  }, []);

  function alternar(id, abierta) {
    setAbiertas((prev) => {
      const nuevo = new Set(prev);
      if (abierta) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p>Cómo hacer las tareas de todos los días, paso a paso.</p>
        </div>
        <div className="acciones">
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <div className="buscador">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar una tarea"
          aria-label="Buscar una tarea"
        />
      </div>

      <div className="print-area ayuda-lista">
        <h2 className="ayuda-titulo-hoja">¿Cómo hago…?</h2>
        {visibles.length === 0 ? (
          <p className="lbl">Ninguna tarea coincide con “{busqueda.trim()}”.</p>
        ) : (
          visibles.map((t) => (
            <details
              key={t.id}
              className="card ayuda-tarea"
              open={imprimiendo || Boolean(busqueda.trim()) || abiertas.has(t.id)}
              onToggle={(e) => {
                if (!imprimiendo && !busqueda.trim()) alternar(t.id, e.currentTarget.open);
              }}
            >
              <summary>{t.titulo}</summary>
              <ol className="ayuda-pasos">
                {t.pasos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {t.ir && (
                <Enlace href={t.ir} className="btn-gold ayuda-ir">
                  Ir ahí
                </Enlace>
              )}
            </details>
          ))
        )}
      </div>
    </>
  );
}
