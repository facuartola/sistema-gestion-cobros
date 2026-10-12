"use client";

import { createContext, useContext } from "react";
import { apiFetch } from "./apiFetch";

async function parsear(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ocurrió un error de conexión.");
  return data;
}

function conCuerpo(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// "jugador" pluraliza irregular ("jugadores", no "jugadors"); "alumno" es
// regular. Nunca agregar una "s" a mano al tipo.
const RUTA_POR_TIPO = { jugador: "jugadores", alumno: "alumnos" };

// Capa de datos real: todo lo que hoy pega contra /api/... vía apiFetch, pero
// detrás de una interfaz común para que /demo pueda alimentar las mismas
// pantallas con datos en memoria (ver lib/dataProviderDemo.js) sin tocar los
// componentes que las usan.
export const dataProviderReal = {
  listarPersonas(tipo, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/${RUTA_POR_TIPO[tipo]}${qs ? `?${qs}` : ""}`).then(parsear);
  },
  crearPersona(tipo, body) {
    return apiFetch(`/api/${RUTA_POR_TIPO[tipo]}`, conCuerpo("POST", body)).then(parsear);
  },
  actualizarPersona(tipo, id, body) {
    return apiFetch(`/api/${RUTA_POR_TIPO[tipo]}/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  guardarCuota(tipo, id, body) {
    return apiFetch(`/api/${RUTA_POR_TIPO[tipo]}/${id}/cuotas`, conCuerpo("POST", body)).then(parsear);
  },
  listarCuotas(tipo, id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/${RUTA_POR_TIPO[tipo]}/${id}/cuotas${qs ? `?${qs}` : ""}`).then(parsear);
  },
  obtenerPanorama() {
    return apiFetch("/api/panorama").then(parsear);
  },
  obtenerResumen(mes) {
    return apiFetch(`/api/resumen?mes=${mes}`).then(parsear);
  },
  listarRecordatorios(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/recordatorios${qs ? `?${qs}` : ""}`).then(parsear);
  },
  crearRecordatorio(body) {
    return apiFetch("/api/recordatorios", conCuerpo("POST", body)).then(parsear);
  },
  actualizarRecordatorio(id, body) {
    return apiFetch(`/api/recordatorios/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  eliminarRecordatorio(id) {
    return apiFetch(`/api/recordatorios/${id}`, { method: "DELETE" }).then(parsear);
  },

  // Gastos: categorías (árbol editable), pagos y comprobantes.
  listarCategoriasGasto() {
    return apiFetch("/api/categorias-gasto").then(parsear);
  },
  crearCategoriaGasto(body) {
    return apiFetch("/api/categorias-gasto", conCuerpo("POST", body)).then(parsear);
  },
  actualizarCategoriaGasto(id, body) {
    return apiFetch(`/api/categorias-gasto/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  eliminarCategoriaGasto(id) {
    return apiFetch(`/api/categorias-gasto/${id}`, { method: "DELETE" }).then(parsear);
  },
  listarPagosGasto(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/pagos-gasto${qs ? `?${qs}` : ""}`).then(parsear);
  },
  crearPagoGasto(body) {
    return apiFetch("/api/pagos-gasto", conCuerpo("POST", body)).then(parsear);
  },
  actualizarPagoGasto(id, body) {
    return apiFetch(`/api/pagos-gasto/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  eliminarPagoGasto(id) {
    return apiFetch(`/api/pagos-gasto/${id}`, { method: "DELETE" }).then(parsear);
  },
  subirComprobante(pagoId, archivo) {
    const datos = new FormData();
    datos.append("archivo", archivo);
    // Sin Content-Type: el navegador arma el multipart con su límite.
    return apiFetch(`/api/pagos-gasto/${pagoId}/comprobante`, { method: "POST", body: datos }).then(parsear);
  },
  quitarComprobante(pagoId) {
    return apiFetch(`/api/pagos-gasto/${pagoId}/comprobante`, { method: "DELETE" }).then(parsear);
  },
  urlComprobante(pagoId) {
    return apiFetch(`/api/pagos-gasto/${pagoId}/comprobante`).then(parsear);
  },

  // Certificación: certificaciones, módulos, encuentros, sesiones,
  // inscripciones, liquidaciones y equipo.
  listarCertificaciones() {
    return apiFetch("/api/certificaciones").then(parsear);
  },
  crearCertificacion(body) {
    return apiFetch("/api/certificaciones", conCuerpo("POST", body)).then(parsear);
  },
  actualizarCertificacion(id, body) {
    return apiFetch(`/api/certificaciones/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  obtenerCertificacion(id) {
    return apiFetch(`/api/certificaciones/${id}`).then(parsear);
  },
  liquidarPendientes(certificacionId, body) {
    return apiFetch(`/api/certificaciones/${certificacionId}/liquidar-pendientes`, conCuerpo("POST", body)).then(parsear);
  },
  listarLiquidaciones(certificacionId) {
    return apiFetch(`/api/certificaciones/${certificacionId}/liquidaciones`).then(parsear);
  },
  obtenerModulo(id) {
    return apiFetch(`/api/modulos/${id}`).then(parsear);
  },
  agregarPractica(moduloId) {
    return apiFetch(`/api/modulos/${moduloId}/encuentros`, conCuerpo("POST", {})).then(parsear);
  },
  liquidarModulo(moduloId, body) {
    return apiFetch(`/api/modulos/${moduloId}/liquidar`, conCuerpo("POST", body)).then(parsear);
  },
  actualizarEncuentro(id, body) {
    return apiFetch(`/api/encuentros/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  eliminarEncuentro(id) {
    return apiFetch(`/api/encuentros/${id}`, { method: "DELETE" }).then(parsear);
  },
  actualizarSesion(id, body) {
    return apiFetch(`/api/sesiones/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  inscribirAlumno(body) {
    return apiFetch("/api/inscripciones", conCuerpo("POST", body)).then(parsear);
  },
  obtenerInscripcion(id) {
    return apiFetch(`/api/inscripciones/${id}`).then(parsear);
  },
  cambiarCoach(inscripcionId, coachId) {
    return apiFetch(`/api/inscripciones/${inscripcionId}`, conCuerpo("PATCH", { coach_id: coachId })).then(parsear);
  },
  // { resumen: true } suma por persona lo cobrado y su rol (es_profe, es_coach).
  listarEquipo({ resumen = false } = {}) {
    return apiFetch(resumen ? "/api/equipo?resumen=1" : "/api/equipo").then(parsear);
  },
  crearPersonaEquipo(body) {
    return apiFetch("/api/equipo", conCuerpo("POST", body)).then(parsear);
  },
  actualizarPersonaEquipo(id, body) {
    return apiFetch(`/api/equipo/${id}`, conCuerpo("PATCH", body)).then(parsear);
  },
  eliminarPersonaEquipo(id) {
    return apiFetch(`/api/equipo/${id}`, { method: "DELETE" }).then(parsear);
  },
  obtenerPersonaEquipo(id) {
    return apiFetch(`/api/equipo/${id}`).then(parsear);
  },

  // Copia de seguridad: { blob, nombre, cercaDelLimite }. Falla con un mensaje
  // en castellano si el servidor no pudo armarla entera.
  async descargarCopia(separador = ",") {
    const res = await apiFetch(`/api/copia?sep=${encodeURIComponent(separador)}`);
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null);
      throw new Error(cuerpo?.error || "No se pudo completar la copia. Probá de nuevo en un momento.");
    }
    const nombre = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "copia-de-datos.zip";
    return { blob: await res.blob(), nombre, cercaDelLimite: res.headers.get("X-Copia-Cerca-Del-Limite") === "1" };
  },
};

const DataProviderContext = createContext(dataProviderReal);

// En la app real nunca hace falta envolver nada: el valor por defecto del
// contexto ya es dataProviderReal. Solo /demo envuelve su árbol con este
// Provider pasando dataProviderDemo.
export function DataProviderProvider({ value, children }) {
  return <DataProviderContext.Provider value={value}>{children}</DataProviderContext.Provider>;
}

export function useDataProvider() {
  return useContext(DataProviderContext);
}
