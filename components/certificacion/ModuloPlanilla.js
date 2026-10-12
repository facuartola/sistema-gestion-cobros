"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAcciones } from "../../lib/AccionesContext";
import { useDataProvider } from "../../lib/dataProvider";
import { MAX_PRACTICAS, MODULOS_CON_PRACTICA, montoEncuentro, montoSesion, resumenLiquidacion } from "../../lib/certificacion";
import { diaArgentinaDe, fechaDMA } from "../../lib/fechas";
import { formatoDolares } from "../../lib/moneda";
import { useCandado } from "../../lib/useCandado";
import Enlace from "../Enlace";
import { EsqueletoLista, EsqueletoStats } from "../Esqueleto";
import PagarEquipoModal from "./PagarEquipoModal";
import { NOTA_PAGADO, PillModulo, PillPagado, TablaLiquidacion } from "./comun";

function nombreEncuentro(e) {
  return e.tipo === "practica_final" ? `Práctica final ${e.numero}` : `Clase ${e.numero}`;
}

// Campo de tarifa especial: se guarda al salir del campo. Vacío = la general.
function CampoTarifaEspecial({ valor, general, disabled, onGuardar, etiqueta }) {
  return (
    <input
      className="cell-input input-tarifa"
      type="number"
      min="0"
      step="any"
      inputMode="decimal"
      key={`${valor}`}
      defaultValue={valor ?? ""}
      placeholder={general == null ? "Sin tarifa" : `General ${formatoDolares(general)}`}
      aria-label={etiqueta}
      disabled={disabled}
      onBlur={(e) => {
        const nuevo = e.target.value.trim();
        const actual = valor == null ? "" : String(valor);
        if (nuevo !== actual && !(nuevo !== "" && Number(nuevo) === Number(valor))) onGuardar(nuevo === "" ? null : nuevo);
      }}
    />
  );
}

// Planilla de un módulo: clases (y prácticas finales en 9 y 10), sesiones de los
// alumnos inscriptos, lo que se debe pagar y el botón para pagar al equipo.
export default function ModuloPlanilla({ moduloId, onConfigurar }) {
  const provider = useDataProvider();
  const { version, refrescar, avisar } = useAcciones();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [pagando, setPagando] = useState(false);
  const candado = useCandado();

  // Solo vale la última lectura: si se cambia de módulo (o se refresca) mientras
  // una respuesta vieja viaja, esa respuesta no pisa la planilla nueva.
  const ultimoPedido = useRef(0);
  const cargar = useCallback(async () => {
    const mio = ++ultimoPedido.current;
    try {
      const r = await provider.obtenerModulo(moduloId);
      if (mio === ultimoPedido.current) setDatos(r);
    } catch (err) {
      if (mio === ultimoPedido.current) setError(err.message || "No se pudo cargar el módulo.");
    } finally {
      if (mio === ultimoPedido.current) setCargando(false);
    }
  }, [provider, moduloId]);

  useEffect(() => {
    cargar();
    return () => {
      ultimoPedido.current += 1;
    };
  }, [cargar, version]);

  // Guarda un cambio y vuelve a leer la planilla. Los errores de la base (lo
  // ya pagado, las prácticas) se muestran tal cual.
  function guardar(id, accion) {
    return candado.ejecutar(async () => {
      setOcupado(id);
      setError("");
      try {
        await accion();
        refrescar();
        await cargar();
      } catch (err) {
        setError(err.message || "No se pudo guardar el cambio.");
        await cargar();
      } finally {
        setOcupado(null);
      }
    });
  }

  if (cargando) {
    return (
      <>
        <EsqueletoStats />
        <div className="card panel">
          <EsqueletoLista items={4} />
        </div>
      </>
    );
  }
  if (!datos) {
    return (
      <div className="card estado-vacio">
        <h3>No se pudo abrir el módulo</h3>
        <p>{error || "Puede que el enlace esté mal escrito."}</p>
        <div className="estado-vacio-acciones">
          <Enlace href="/certificacion/modulos" className="btn-gold">
            Ver los módulos
          </Enlace>
        </div>
      </div>
    );
  }

  const { certificacion: cert, modulo, encuentros, sesiones, equipo, liquidacion, practicas, modulos } = datos;
  const cerrado = Boolean(modulo.cerrado_en);
  const activos = equipo.filter((p) => p.activo);
  const resumen = resumenLiquidacion(liquidacion);
  const permitePractica = MODULOS_CON_PRACTICA.includes(modulo.numero);
  const indice = modulos.findIndex((m) => m.id === modulo.id);
  const anterior = modulos[indice - 1];
  const siguiente = modulos[indice + 1];
  const hayPagados = encuentros.some((e) => e.pago_gasto_id) || sesiones.some((s) => s.pago_gasto_id);
  const motivoNoPagar = cerrado
    ? null
    : !modulo.listo_para_liquidar
      ? `Para pagar al equipo, las ${modulo.encuentros_total} clases tienen que estar dadas (van ${modulo.encuentros_dictados}).`
      : resumen.faltaTarifa
        ? "Falta definir la tarifa de la certificación."
        : null;

  return (
    <>
      <div className="planilla-cabecera">
        <h2 className="titulo-modulo">
          Módulo {modulo.numero} <PillModulo fila={modulo} />
        </h2>
        <div className="acciones">
          {anterior && (
            <Enlace href={`/certificacion/modulos/${anterior.id}`} className="btn-ghost">
              ← Módulo {anterior.numero}
            </Enlace>
          )}
          {siguiente && (
            <Enlace href={`/certificacion/modulos/${siguiente.id}`} className="btn-ghost">
              Módulo {siguiente.numero} →
            </Enlace>
          )}
        </div>
      </div>
      {cerrado && <p className="lbl">Pagado el {fechaDMA(diaArgentinaDe(modulo.cerrado_en))}</p>}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {hayPagados && <p className="notice-banner nota-pagado">{NOTA_PAGADO}</p>}

      <section className="card seccion-planilla" aria-label="Clases">
        <div className="lista-cabecera">
          <h2 className="panel-titulo">Clases</h2>
          <span className="lbl">
            {modulo.encuentros_dictados} de {modulo.encuentros_total} dadas
          </span>
        </div>
        <div className="table-card">
          <table className="apilable">
            <thead>
              <tr>
                <th>Clase</th>
                <th>Fecha</th>
                <th>Profe</th>
                <th>Dada</th>
                <th>Tarifa especial (US$)</th>
                <th>
                  <span className="sr-only">Estado</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {encuentros.map((e) => {
                const pagado = Boolean(e.pago_gasto_id);
                const bloqueado = ocupado === e.id;
                const opciones = activos.some((p) => p.id === e.profe_id) || !e.profe_id ? activos : [...activos, equipo.find((p) => p.id === e.profe_id)].filter(Boolean);
                const general = e.tipo === "practica_final" ? (cert.tarifa_practica ?? cert.tarifa_encuentro) : cert.tarifa_encuentro;
                return (
                  <tr key={e.id} className={pagado ? "fila-pagada" : undefined}>
                    <td>{nombreEncuentro(e)}</td>
                    <td data-label="Fecha">
                      <input
                        className="cell-input"
                        type="date"
                        key={`f-${e.fecha}`}
                        defaultValue={e.fecha ?? ""}
                        aria-label={`Fecha del ${nombreEncuentro(e).toLowerCase()}`}
                        disabled={bloqueado}
                        onBlur={(ev) => {
                          if ((ev.target.value || null) !== (e.fecha || null)) guardar(e.id, () => provider.actualizarEncuentro(e.id, { fecha: ev.target.value || null }));
                        }}
                      />
                    </td>
                    <td data-label="Profe">
                      <select
                        className="cell-input"
                        value={e.profe_id ?? ""}
                        aria-label={`Profe del ${nombreEncuentro(e).toLowerCase()}`}
                        disabled={bloqueado || pagado}
                        onChange={(ev) => guardar(e.id, () => provider.actualizarEncuentro(e.id, { profe_id: ev.target.value || null }))}
                      >
                        <option value="">Sin asignar</option>
                        {opciones.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                            {p.activo ? "" : " (desactivada)"}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Dada">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={e.dictado}
                          disabled={bloqueado || pagado || (!e.profe_id && !e.dictado)}
                          title={!e.profe_id ? "Primero elegí quién la dio" : undefined}
                          onChange={(ev) => guardar(e.id, () => provider.actualizarEncuentro(e.id, { dictado: ev.target.checked }))}
                        />
                        <span>{e.dictado ? "Dada" : "Falta darla"}</span>
                      </label>
                    </td>
                    <td data-label="Tarifa especial (US$)">
                      <CampoTarifaEspecial
                        valor={e.tarifa}
                        general={general}
                        etiqueta={`Tarifa especial del ${nombreEncuentro(e).toLowerCase()}`}
                        disabled={bloqueado || pagado}
                        onGuardar={(tarifa) => guardar(e.id, () => provider.actualizarEncuentro(e.id, { tarifa }))}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        {pagado ? (
                          <PillPagado />
                        ) : e.dictado ? (
                          <span className="lbl num">{montoEncuentro(e, cert) == null ? "Sin tarifa" : formatoDolares(montoEncuentro(e, cert))}</span>
                        ) : null}
                        {e.tipo === "practica_final" && !pagado && !e.dictado && (
                          <button
                            type="button"
                            className="link-action danger"
                            disabled={bloqueado}
                            onClick={() => guardar(e.id, () => provider.eliminarEncuentro(e.id))}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {permitePractica && (
          <div className="pie-seccion">
            <button
              type="button"
              className="btn-ghost"
              disabled={ocupado === "practica"}
              onClick={() =>
                guardar("practica", async () => {
                  await provider.agregarPractica(modulo.id);
                  avisar("Se agregó una práctica final.");
                })
              }
            >
              Agregar práctica final
            </button>
            <span className="lbl">
              Prácticas finales de la certificación: {practicas} de {MAX_PRACTICAS} (entre los módulos 9 y 10)
            </span>
          </div>
        )}
      </section>

      <section className="card seccion-planilla" aria-label="Sesiones de coaching">
        <div className="lista-cabecera">
          <h2 className="panel-titulo">Sesiones de coaching</h2>
          <span className="lbl">
            {modulo.sesiones_realizadas} de {modulo.sesiones_total} hechas
          </span>
        </div>
        {sesiones.length === 0 ? (
          <p className="vacio-lista">
            Todavía no hay alumnos inscriptos.{" "}
            <Enlace href="/certificacion/alumnos" className="link-action">
              Inscribir alumnos
            </Enlace>
          </p>
        ) : (
          <div className="table-card">
            <table className="apilable">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Coach</th>
                  <th>Realizada</th>
                  <th>Fecha</th>
                  <th>Tarifa especial (US$)</th>
                  <th>
                    <span className="sr-only">Estado</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => {
                  const pagado = Boolean(s.pago_gasto_id);
                  const bloqueado = ocupado === s.id;
                  const coach = equipo.find((p) => p.id === s.coach_id)?.nombre;
                  return (
                    <tr key={s.id} className={pagado ? "fila-pagada" : undefined}>
                      <td>{s.alumno}</td>
                      <td data-label="Coach">{coach ?? <span className="celda-vacia">Sin coach</span>}</td>
                      <td data-label="Realizada">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={s.realizada}
                            disabled={bloqueado || pagado || (!s.coach_id && !s.realizada)}
                            title={!s.coach_id ? "El alumno no tiene coach" : undefined}
                            onChange={(ev) => guardar(s.id, () => provider.actualizarSesion(s.id, { realizada: ev.target.checked }))}
                          />
                          <span>{s.realizada ? "Hecha" : "Falta hacerla"}</span>
                        </label>
                      </td>
                      <td data-label="Fecha">
                        <input
                          className="cell-input"
                          type="date"
                          key={`f-${s.fecha_realizada}`}
                          defaultValue={s.fecha_realizada ?? ""}
                          aria-label={`Fecha de la sesión de ${s.alumno}`}
                          disabled={bloqueado || !s.realizada}
                          onBlur={(ev) => {
                            if (ev.target.value && ev.target.value !== s.fecha_realizada) {
                              guardar(s.id, () => provider.actualizarSesion(s.id, { fecha_realizada: ev.target.value }));
                            }
                          }}
                        />
                      </td>
                      <td data-label="Tarifa especial (US$)">
                        <CampoTarifaEspecial
                          valor={s.tarifa}
                          general={cert.tarifa_sesion}
                          etiqueta={`Tarifa especial de la sesión de ${s.alumno}`}
                          disabled={bloqueado || pagado}
                          onGuardar={(tarifa) => guardar(s.id, () => provider.actualizarSesion(s.id, { tarifa }))}
                        />
                      </td>
                      <td>
                        {pagado ? (
                          <PillPagado />
                        ) : s.realizada ? (
                          <span className="lbl num">{montoSesion(s, cert) == null ? "Sin tarifa" : formatoDolares(montoSesion(s, cert))}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card seccion-planilla" aria-label="Lo que se paga al equipo">
        <div className="lista-cabecera">
          <h2 className="panel-titulo">{cerrado ? "Lo que quedó sin pagar (para “Pagar lo atrasado”)" : "Lo que se paga al equipo"}</h2>
          <span className="lbl">{resumen.vacio ? "" : resumen.faltaTarifa ? "Falta definir la tarifa" : formatoDolares(resumen.total)}</span>
        </div>
        <div className="bloque-interno">
          {!cerrado && <p className="lbl" style={{ marginBottom: 12 }}>Incluye lo hecho y no pagado de este módulo y de los anteriores.</p>}
          <TablaLiquidacion onConfigurar={onConfigurar} filas={liquidacion} vacio={cerrado ? "Este módulo ya está pagado y no queda nada sin pagar." : "Todavía no hay nada para pagar en este módulo."} />
          {!cerrado && (
            <div className="acciones" style={{ marginTop: 14 }}>
              <button type="button" className="btn-gold" disabled={Boolean(motivoNoPagar)} onClick={() => setPagando(true)}>
                Pagar al equipo
              </button>
              {motivoNoPagar && <span className="lbl">{motivoNoPagar}</span>}
            </div>
          )}
          {cerrado && liquidacion.length > 0 && (
            <div className="acciones" style={{ marginTop: 14 }}>
              <Enlace href="/certificacion/modulos" className="btn-ghost">
                Ir a “Pagar lo atrasado”
              </Enlace>
            </div>
          )}
        </div>
      </section>

      {pagando && (
        <PagarEquipoModal
          titulo={`Pagar al equipo: Módulo ${modulo.numero}`}
          explicacion="Al confirmar se crean los pagos en Gastos, lo pagado queda bloqueado y el módulo se cierra. Un módulo se paga una sola vez."
          filas={liquidacion}
          equipo={equipo}
          confirmar={(d) => provider.liquidarModulo(modulo.id, d)}
          onTerminado={() => {
            refrescar();
            cargar();
          }}
          onClose={() => setPagando(false)}
        />
      )}
    </>
  );
}
