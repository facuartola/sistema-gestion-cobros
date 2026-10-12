"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { diaArgentinaDe, hoyArgentinaISO } from "../../lib/fechas";
import { gruposParaPantalla } from "../../lib/recordatoriosAgrupar";
import { calcularSugerencias } from "../../lib/sugerencias";
import { useRecordatoriosContext } from "../../lib/RecordatoriosContext";
import { useCandado } from "../../lib/useCandado";
import { usePersonasActivas } from "../../lib/usePersonasActivas";
import RecordatorioForm from "../../components/RecordatorioForm";
import { EsqueletoLista } from "../../components/Esqueleto";
import Enlace from "../../components/Enlace";
import { useAcciones } from "../../lib/AccionesContext";

const TIPOS = { general: "General", cobro: "Cobro", seguimiento: "Seguimiento" };

function fechaLegible(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function EditorRecordatorio({ recordatorio, onGuardar, onCancelar }) {
  const [titulo, setTitulo] = useState(recordatorio.titulo);
  const [fecha, setFecha] = useState(recordatorio.fecha);
  const [tipo, setTipo] = useState(recordatorio.tipo);
  const [nota, setNota] = useState(recordatorio.nota || "");
  const [error, setError] = useState("");
  const candado = useCandado();
  const guardando = candado.ocupado;

  function guardar() {
    return candado.ejecutar(async () => {
      if (!titulo.trim()) return setError("El título no puede quedar vacío.");
      setError("");
      try {
        await onGuardar({ titulo: titulo.trim(), fecha, tipo, nota: nota.trim() || null });
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <div className="recordatorio-editor">
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="recordatorio-editor-grid">
        <label className="field">
          <span>Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={guardando} autoFocus />
        </label>
        <label className="field">
          <span>Para el día</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={guardando}>
            {Object.entries(TIPOS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Nota</span>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} disabled={guardando} />
      </label>
      <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="btn-gold" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FilaRecordatorio({ recordatorio, persona, hoy, editando, onEditar, onCancelarEdicion, onGuardarEdicion, onToggleHecho, onEliminar }) {
  if (editando) {
    return (
      <li className="recordatorio-item card">
        <EditorRecordatorio recordatorio={recordatorio} onGuardar={onGuardarEdicion} onCancelar={onCancelarEdicion} />
      </li>
    );
  }

  const vencido = !recordatorio.hecho && recordatorio.fecha < hoy;
  return (
    <li className="recordatorio-item card">
      <label className="recordatorio-check">
        <input
          type="checkbox"
          checked={recordatorio.hecho}
          onChange={onToggleHecho}
          aria-label={recordatorio.hecho ? `Volver a dejar pendiente: ${recordatorio.titulo}` : `Marcar como hecho: ${recordatorio.titulo}`}
        />
      </label>
      <div className="recordatorio-cuerpo">
        <p className="recordatorio-titulo">
          {recordatorio.titulo}
          {recordatorio.tipo !== "general" && <span className={`badge tipo-${recordatorio.tipo}`}>{TIPOS[recordatorio.tipo]}</span>}
        </p>
        <p className="recordatorio-meta">
          {recordatorio.hecho
            ? `Hecho el ${fechaLegible(recordatorio.hecho_en ? diaArgentinaDe(recordatorio.hecho_en) : recordatorio.fecha)}`
            : vencido
              ? `Era para el ${fechaLegible(recordatorio.fecha)}`
              : fechaLegible(recordatorio.fecha)}
          {persona && (
            <>
              {", "}
              <Enlace href={`/cobros?tipo=${persona.tipo}`}>{persona.nombre}</Enlace>
            </>
          )}
        </p>
        {recordatorio.nota && <p className="recordatorio-nota">{recordatorio.nota}</p>}
      </div>
      <div className="row-actions">
        <button className="link-action" onClick={onEditar}>
          Editar
        </button>
        <button className="link-action danger" onClick={onEliminar}>
          Eliminar
        </button>
      </div>
    </li>
  );
}

export default function RecordatoriosPage() {
  return (
    <Suspense fallback={<EsqueletoLista items={4} />}>
      <RecordatoriosContenido />
    </Suspense>
  );
}

function RecordatoriosContenido() {
  const searchParams = useSearchParams();
  const {
    recordatorios,
    loading,
    error: errorCarga,
    grupos: gruposBase,
    hoy,
    actualizar,
    toggleHecho: toggleHechoCtx,
    eliminar: eliminarCtx,
  } = useRecordatoriosContext();
  const { avisar } = useAcciones();
  const { personasActivas, buscarPersona } = usePersonasActivas();
  const [errorAccion, setErrorAccion] = useState("");
  const [aviso, setAviso] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);

  const error = errorAccion || errorCarga;
  const grupos = useMemo(() => gruposParaPantalla(gruposBase), [gruposBase]);

  // Acceso rápido desde el panel de una persona: /recordatorios?persona_tipo=jugador&persona_id=...&persona_nombre=...
  useEffect(() => {
    const tipo = searchParams.get("persona_tipo");
    const id = searchParams.get("persona_id");
    const nombre = searchParams.get("persona_nombre");
    if (tipo && id) {
      setPrefill({
        titulo: "",
        fecha: hoyArgentinaISO(),
        tipo: "general",
        jugador_id: tipo === "jugador" ? id : null,
        alumno_id: tipo === "alumno" ? id : null,
        nombrePersona: nombre || "",
      });
      setFormKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sugerencias = useMemo(() => calcularSugerencias(personasActivas), [personasActivas]);

  function crearDesdeSugerencia(s) {
    setPrefill(s.prefill);
    setFormKey((k) => k + 1);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function alCrear(nuevo) {
    setPrefill(null);
    setAviso(`Se agregó "${nuevo.titulo}".`);
  }

  async function toggleHecho(r) {
    setErrorAccion("");
    try {
      await toggleHechoCtx(r);
      if (!r.hecho) {
        avisar(`Listo: "${r.titulo}" quedó hecho.`, () => toggleHechoCtx({ ...r, hecho: true }).catch(() => {}));
      }
    } catch (err) {
      setErrorAccion(err.message || "Ocurrió un error de conexión.");
    }
  }

  async function guardarEdicion(r, cambios) {
    await actualizar(r.id, cambios);
    setEditandoId(null);
    setAviso("Se guardaron los cambios.");
  }

  async function eliminar(r) {
    const ok = window.confirm(`¿Eliminar el recordatorio "${r.titulo}"?`);
    if (!ok) return;
    setErrorAccion("");
    try {
      await eliminarCtx(r.id);
      setAviso("Se eliminó el recordatorio.");
    } catch (err) {
      setErrorAccion(err.message || "Ocurrió un error de conexión.");
    }
  }

  const secciones = [
    { clave: "hoy", titulo: "Hoy" },
    { clave: "semana", titulo: "Esta semana" },
    { clave: "masAdelante", titulo: "Más adelante" },
  ];

  const fila = (r) => (
    <FilaRecordatorio
      key={r.id}
      recordatorio={r}
      persona={buscarPersona(r)}
      hoy={hoy}
      editando={editandoId === r.id}
      onEditar={() => setEditandoId(r.id)}
      onCancelarEdicion={() => setEditandoId(null)}
      onGuardarEdicion={(cambios) => guardarEdicion(r, cambios)}
      onToggleHecho={() => toggleHecho(r)}
      onEliminar={() => eliminar(r)}
    />
  );

  return (
    <>
      <div className="page-header">
        <p>Lo que no te tenés que olvidar. Tildá lo que ya hiciste.</p>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="notice-banner" role="status">{aviso}</div>}

      <RecordatorioForm key={formKey} personas={personasActivas} prefill={prefill} onCreado={alCrear} />

      {loading && (
        <div className="card panel">
          <EsqueletoLista items={4} />
        </div>
      )}

      {!loading && recordatorios.length === 0 && !error && <p className="lbl">Todavía no cargaste nada. Agregá lo primero arriba.</p>}

      {!loading &&
        secciones.map(({ clave, titulo }) =>
          grupos[clave].length > 0 ? (
            <section key={clave} className="recordatorio-seccion">
              <h2 className="recordatorio-seccion-titulo">{titulo}</h2>
              <ul className="recordatorio-lista">{grupos[clave].map(fila)}</ul>
            </section>
          ) : null
        )}

      {!loading && sugerencias.length > 0 && (
        <details className="recordatorio-seccion" open={sugerenciasAbiertas} onToggle={(e) => setSugerenciasAbiertas(e.currentTarget.open)}>
          <summary className="recordatorio-seccion-titulo">Sugerencias ({sugerencias.length})</summary>
          <div className="card sugerencias-bloque">
            <ul className="sugerencias-lista">
              {sugerencias.map((s) => (
                <li key={s.clave}>
                  <span>{s.texto}</span>
                  <button type="button" className="btn-ghost" onClick={() => crearDesdeSugerencia(s)}>
                    Agregar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {!loading && grupos.hechos.length > 0 && (
        <details className="recordatorio-seccion">
          <summary className="recordatorio-seccion-titulo">Hechos ({grupos.hechos.length})</summary>
          <ul className="recordatorio-lista">{grupos.hechos.map(fila)}</ul>
        </details>
      )}
    </>
  );
}
