"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiFetch";
import { EsqueletoLista } from "../../components/Esqueleto";
import { fechaHoraArgentina } from "../../lib/fechas";

// Página discreta (no está en el sidebar) para revisar los últimos errores
// registrados, tanto del frontend (error boundary) como de las rutas API.
export default function ErroresPage() {
  const [errores, setErrores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/api/errores");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los errores.");
        setErrores(data);
      } catch (err) {
        setErrores([]);
        setError(err.message || "Ocurrió un error de conexión.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  return (
    <>
      <div className="page-header">
        <p>Últimos errores detectados en la app (más nuevo primero)</p>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {loading && (
        <div className="card panel">
          <EsqueletoLista items={3} />
        </div>
      )}

      {!loading && errores.length === 0 && !error && (
        <p className="lbl">No hay errores registrados.</p>
      )}

      {!loading && errores.length > 0 && (
        <div className="table-card card">
          <table>
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Origen</th>
                <th>Ruta</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {errores.map((e) => (
                <tr key={e.id}>
                  <td>{fechaHoraArgentina(e.creado_en)}</td>
                  <td>{e.origen}</td>
                  <td>{e.ruta || <span className="celda-vacia">—</span>}</td>
                  <td title={e.stack || ""} style={{ maxWidth: 420 }}>
                    {e.mensaje}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
