"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClienteModal from "./ClienteModal";
import Avatar from "./Avatar";
import { EsqueletoLista } from "./Esqueleto";
import MonthSelect from "./MonthSelect";
import PanelCliente from "./PanelCliente";
import { useAcciones } from "../lib/AccionesContext";
import { PESTANAS_COBROS, estadoDeCobro, fraseDeResumen, montoDeCuota, porcentajeAbonado, textoDeuda, tipoValido } from "../lib/cobros";
import { descargarCSV } from "../lib/csv";
import { useDataProvider } from "../lib/dataProvider";
import { fechaDMA, hoyArgentinaISO, mesLabel } from "../lib/fechas";
import { formatoDolares } from "../lib/moneda";
import { normalizar } from "../lib/navegacion";
import { useMenu } from "../lib/useMenu";
import { ETIQUETA_METODO } from "../lib/metodoPago";
import { CLAVES_NAVEGADOR, enDemo } from "../lib/navegador";

// La pestaña con la que se abre Cobros: la que pide la dirección (?tipo=), si
// no la última que se usó, y si no Jugadores.
function pestanaInicial(pedida) {
  const desdeDireccion = tipoValido(pedida) || tipoValido(new URLSearchParams(window.location.search).get("tipo"));
  if (desdeDireccion) return desdeDireccion;
  try {
    return (!enDemo() && tipoValido(localStorage.getItem(CLAVES_NAVEGADOR.pestanaCobros))) || "jugador";
  } catch {
    return "jugador";
  }
}

// Una sola pantalla de Cobros con las pestañas Jugadores y Alumnos de la
// certificación. Las filas son de solo lectura: "Cobré" registra el cobro en un
// paso y tocar la fila abre el panel con todo lo que se puede cambiar.
export default function CobrosPagina({ tipoPedido = null }) {
  const provider = useDataProvider();
  const { mes, setMes, version, refrescar, busquedaPendiente, consumirBusqueda } = useAcciones();
  const [tipo, setTipo] = useState(null); // null hasta leer la pestaña recordada
  const [personas, setPersonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [abiertoId, setAbiertoId] = useState(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [aviso, setAviso] = useState("");
  const { abrirCobro } = useAcciones();
  const { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu } = useMenu('[role="menuitem"]');

  // Se lee después de montar para que el primer dibujo coincida con el del servidor.
  useEffect(() => {
    setTipo(pestanaInicial(tipoPedido));
  }, [tipoPedido]);

  function elegirPestana(nuevo) {
    if (nuevo === tipo) return;
    setTipo(nuevo);
    setAbiertoId(null);
    setBusqueda("");
    setAviso("");
    try {
      if (!enDemo()) localStorage.setItem(CLAVES_NAVEGADOR.pestanaCobros, nuevo);
    } catch {
      // Sin localStorage, la pestaña simplemente no se recuerda.
    }
  }

  // Llegaste desde el buscador (Ctrl+K) eligiendo a una persona: se abre su
  // pestaña con el nombre ya puesto.
  useEffect(() => {
    if (!busquedaPendiente || !tipoValido(busquedaPendiente.tipo)) return;
    setTipo(busquedaPendiente.tipo);
    setBusqueda(busquedaPendiente.nombre);
    consumirBusqueda();
  }, [busquedaPendiente, consumirBusqueda]);

  // Siempre se recarga el mes y la pestaña de AHORA, y solo se aplica la
  // respuesta del último pedido: una respuesta lenta de otro mes no pisa la lista.
  const mesRef = useRef(mes);
  mesRef.current = mes;
  const ultimoPedido = useRef(0);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!tipo) return;
      const pedido = ++ultimoPedido.current;
      if (!silencioso) {
        setCargando(true);
        setError("");
      }
      try {
        const data = await provider.listarPersonas(tipo, { mes: mesRef.current });
        if (pedido !== ultimoPedido.current) return;
        setPersonas(data);
        setError("");
      } catch (err) {
        if (pedido !== ultimoPedido.current) return;
        if (!silencioso) setPersonas([]);
        setError(err.message || "Ocurrió un error de conexión.");
      } finally {
        if (pedido === ultimoPedido.current) setCargando(false);
      }
    },
    [provider, tipo]
  );

  useEffect(() => {
    cargar();
  }, [cargar, mes]);

  // Algo cambió desde otra parte de la app (un cobro, un cliente nuevo, un
  // cambio en el panel): se recarga sin vaciar la lista.
  const versionVista = useRef(version);
  useEffect(() => {
    if (versionVista.current === version) return;
    versionVista.current = version;
    cargar({ silencioso: true });
  }, [version, cargar]);

  const esAlumno = tipo === "alumno";
  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    return personas.filter((p) => !q || normalizar(p.nombre).includes(q));
  }, [personas, busqueda]);
  const abierta = abiertoId ? personas.find((p) => p.id === abiertoId) || null : null;

  // Si la persona abierta desaparece de la lista (baja), el panel se cierra.
  useEffect(() => {
    if (abiertoId && !cargando && !abierta) setAbiertoId(null);
  }, [abiertoId, cargando, abierta]);

  // El aviso de "Se agregó a…" se apaga solo.
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const frase = fraseDeResumen(personas);
  const cobradoMes = personas.reduce((acc, p) => acc + (p.cuota_actual?.estado === "pagado" ? Number(p.cuota_actual.monto) : 0), 0);
  const cobradoAnio = personas.reduce((acc, p) => acc + Number(p.total_anio || 0), 0);

  function exportar() {
    const columnas = [
      { label: esAlumno ? "Alumno" : "Jugador", value: (p) => p.nombre },
      { label: "Monto (US$)", value: (p) => montoDeCuota(p) },
      { label: "Día de vencimiento", value: (p) => p.dia_vencimiento ?? "" },
      { label: "Estado", value: (p) => estadoDeCobro(p, mes).texto },
      { label: "Meses adeudados", value: (p) => p.meses_adeudados ?? 0 },
      { label: "Fecha de pago", value: (p) => p.cuota_actual?.fecha_pago || "" },
      { label: "Método de pago", value: (p) => ETIQUETA_METODO[p.cuota_actual?.metodo_pago] || "" },
      { label: "Total del año (US$)", value: (p) => p.total_anio ?? 0 },
    ];
    descargarCSV(`cuotas-${esAlumno ? "alumnos" : "jugadores"}-${mes}.csv`, filtradas, columnas);
  }

  async function alGuardarCliente(tipoGuardado, nombreGuardado) {
    setAltaAbierta(false);
    if (tipoGuardado !== tipo) elegirPestana(tipoGuardado);
    else await cargar({ silencioso: true });
    // Certificación, Inicio y el buscador también tienen que enterarse del cliente nuevo.
    refrescar();
    setAviso(`Se agregó a ${nombreGuardado}.`);
  }

  const titulo = esAlumno ? "Alumnos de la certificación" : "Jugadores";

  return (
    <>
      <div className="page-header">
        <div>
          <p>Quién ya pagó y quién falta este mes. Tocá a una persona para ver o cambiar sus datos.</p>
          {frase && !cargando && <p className="frase-cobros">{frase}</p>}
        </div>
        <div className="acciones">
          <button type="button" className="btn-gold" onClick={() => setAltaAbierta(true)} disabled={!tipo}>
            + Agregar cliente
          </button>
          <MonthSelect value={mes} onChange={setMes} />
          <div className="menu-wrap" ref={contenedor}>
            <button
              type="button"
              className="btn-ghost"
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-label="Más acciones"
              onClick={() => setAbierto((a) => !a)}
            >
              ⋯
            </button>
            <div className={`menu glass${abierto ? " open" : ""}`} role="menu" aria-label="Más acciones" onKeyDown={onKeyDownMenu}>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                disabled={personas.length === 0}
                onClick={() => {
                  cerrar();
                  exportar();
                }}
              >
                Exportar a Excel
                <small>Se abre en Excel con columnas</small>
              </button>
              <button
                type="button"
                role="menuitem"
                className="mi"
                tabIndex={abierto ? 0 : -1}
                disabled={personas.length === 0}
                onClick={() => {
                  cerrar();
                  window.print();
                }}
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pestanas" role="tablist" aria-label="Cobros">
        {PESTANAS_COBROS.map((p) => (
          <button
            key={p.tipo}
            type="button"
            role="tab"
            aria-selected={tipo === p.tipo}
            className={`pestana${tipo === p.tipo ? " on" : ""}`}
            onClick={() => elegirPestana(p.tipo)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}{" "}
          <button type="button" className="link-action" onClick={() => cargar()}>
            Reintentar
          </button>
        </div>
      )}
      {aviso && (
        <div className="notice-banner" role="status">
          {aviso}
        </div>
      )}

      <div className="buscador">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar por nombre"
        />
      </div>

      <div className="print-area">
        <div className="print-only">
          <h2>Cobros: {titulo}</h2>
          <p>
            {mesLabel(mes)}, generado el {fechaDMA(hoyArgentinaISO())}
          </p>
        </div>

        {cargando || !tipo ? (
          <div className="card panel">
            <EsqueletoLista items={4} alto={16} />
          </div>
        ) : personas.length === 0 && !error ? (
          <div className="card estado-vacio">
            <h3>Todavía no hay {esAlumno ? "alumnos" : "jugadores"} cargados</h3>
            <p>
              Cargá a cada {esAlumno ? "alumno" : "jugador"} con su monto mensual y el día en que tiene que pagar. Desde acá vas a
              registrar lo que cobrás cada mes.
            </p>
            <div className="estado-vacio-acciones">
              <button type="button" className="btn-gold" onClick={() => setAltaAbierta(true)}>
                Agregar el primero
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="cobros-lista card" aria-label={titulo}>
              {filtradas.length === 0 && <li className="cobro-vacio">Nadie coincide con “{busqueda.trim()}”.</li>}
              {filtradas.map((p) => {
                const estado = estadoDeCobro(p, mes);
                const deuda = textoDeuda(p.meses_adeudados);
                const pagado = p.cuota_actual?.estado === "pagado";
                return (
                  <li key={p.id} className="cobro-fila" onClick={() => setAbiertoId(p.id)}>
                    <div className="cobro-nombre">
                      <Avatar nombre={p.nombre} />
                      <div className="cobro-nombre-texto">
                        <button
                          type="button"
                          className="cobro-abrir"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAbiertoId(p.id);
                          }}
                          aria-label={`Ver o cambiar los datos de ${p.nombre}`}
                        >
                          {p.nombre}
                        </button>
                        {deuda && <span className="deuda-texto">{deuda}</span>}
                        {esAlumno && p.monto_total ? (
                          <div className="cobro-progreso" title={`${porcentajeAbonado(p.total_abonado, p.monto_total)}% abonado`}>
                            <span className="progreso-texto">
                              {formatoDolares(p.total_abonado)} de {formatoDolares(p.monto_total)}
                            </span>
                            <div className={`progreso-barra${Number(p.total_abonado) >= Number(p.monto_total) ? " completo" : ""}`}>
                              <div style={{ width: `${porcentajeAbonado(p.total_abonado, p.monto_total)}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="cobro-monto num" data-etiqueta="Monto">
                      {formatoDolares(montoDeCuota(p))}
                    </div>
                    <div className="cobro-vence" data-etiqueta="Vence">
                      {p.dia_vencimiento ? `Día ${p.dia_vencimiento}` : <span className="celda-vacia">Sin vencimiento</span>}
                    </div>
                    <div className="cobro-estado">
                      <span className={`badge ${estado.tono}`}>{estado.texto}</span>
                    </div>
                    <div className="cobro-accion">
                      {!pagado && (
                        <button
                          type="button"
                          className="btn-gold"
                          aria-label={`Cobré a ${p.nombre}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirCobro({ persona: { ...p, tipo }, mes });
                          }}
                        >
                          Cobré
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="lbl cobros-totales">
              Cuotas de {mesLabel(mes).toLowerCase()} cobradas: {formatoDolares(cobradoMes)} · en el año: {formatoDolares(cobradoAnio)}. Acá se cuenta por el mes de la cuota; el Inicio cuenta por la fecha en que se cobró.
            </p>
          </>
        )}
      </div>

      {abierta && <PanelCliente key={abierta.id} persona={abierta} tipo={tipo} mes={mes} onClose={() => setAbiertoId(null)} />}
      {altaAbierta && <ClienteModal tipoInicial={tipo || "jugador"} onClose={() => setAltaAbierta(false)} onSaved={alGuardarCliente} />}
    </>
  );
}
