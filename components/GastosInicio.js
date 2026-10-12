"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { useDataProvider } from "../lib/dataProvider";
import { hoyArgentinaISO, sumarDiasISO } from "../lib/fechas";
import { armarGrupos, contarTarjetas, filtrarGrupos } from "../lib/gastosTarjetas";
import { useGastos } from "../lib/GastosContext";
import { leerUltimoMetodo } from "../lib/metodoPago";
import { formatoDolares } from "../lib/moneda";
import Enlace from "./Enlace";
import { EsqueletoLista } from "./Esqueleto";

// Una tarjeta: el nombre, cómo está y un solo botón. "Pagué" registra el pago
// en un paso (monto del tipo, último método, hoy); "Registrar pago" abre la
// ventana con el tipo ya elegido, donde también se adjunta el comprobante.
function Tarjeta({ t, hoy, ocupado, onPagar, onRegistrar }) {
  const limite = sumarDiasISO(hoy, 7);
  const punto = t.tono === "warn" ? "vencido" : t.rango === 1 && t.vencimiento && t.vencimiento <= limite ? "proximo" : null;
  return (
    <li className={`tarjeta-gasto card${t.tono === "warn" ? " vencida" : ""}`}>
      <div className="tarjeta-gasto-cabecera">
        <h4>{t.nombre}</h4>
        {punto && <span className={`dot ${punto}`} role="img" aria-label={punto === "vencido" ? "Vencido" : "Vence pronto"} />}
      </div>
      <p className={`tarjeta-gasto-estado${t.tono ? ` ${t.tono}` : ""}`}>{t.texto}</p>
      <div className="tarjeta-gasto-acciones">
        {t.accion && (
          <button
            type="button"
            className="btn-gold"
            disabled={ocupado}
            aria-label={`${t.etiqueta}: ${t.nombre}`}
            onClick={() => (t.accion === "pagar" ? onPagar(t) : onRegistrar(t))}
          >
            {ocupado ? "Guardando…" : t.etiqueta}
          </button>
        )}
        <Enlace href={`/gastos/${t.id}`} className="link-action" aria-label={`Ver historial de ${t.nombre}`}>
          Ver historial
        </Enlace>
      </div>
    </li>
  );
}

// El equipo de coaches: sus pagos los genera "Pagar al equipo" en la
// certificación, así que no hay una tarjeta por cada tipo.
function TarjetaEquipo({ t }) {
  return (
    <li className="tarjeta-gasto card">
      <div className="tarjeta-gasto-cabecera">
        <h4>{t.nombre}</h4>
      </div>
      <p className="tarjeta-gasto-estado">Se pagan desde la certificación, con “Pagar al equipo”.</p>
      <div className="tarjeta-gasto-acciones">
        <Enlace href="/certificacion" className="btn-gold">
          Ir a Certificación
        </Enlace>
        <Enlace href={`/gastos/${t.historialId}`} className="link-action" aria-label="Ver historial de pagos al equipo">
          Ver historial
        </Enlace>
      </div>
    </li>
  );
}

function Grupo({ grupo, buscando, plegados, alternar, ...resto }) {
  const cantidad = contarTarjetas(grupo);
  const plegado = !buscando && plegados.has(grupo.id);
  const idCuerpo = `grupo-${grupo.id}`;
  const Titulo = grupo.nivel === 1 ? "h3" : "h4";
  return (
    <section className={`grupo-gasto nivel-${grupo.nivel}`} aria-label={grupo.sinTitulo ? "Otros gastos" : grupo.nombre}>
      {!grupo.sinTitulo && (
        <Titulo className="grupo-gasto-titulo">
          <button type="button" aria-expanded={!plegado} aria-controls={idCuerpo} onClick={() => alternar(grupo.id)}>
            <span className="grupo-gasto-flecha" aria-hidden="true">
              {plegado ? "▸" : "▾"}
            </span>
            <span>{grupo.nombre}</span>
            <span className="lbl">{cantidad === 1 ? "1 gasto" : `${cantidad} gastos`}</span>
          </button>
          <Enlace href={`/gastos/${grupo.id}`} className="link-action" aria-label={`Ver historial de ${grupo.nombre}`}>
            Ver historial
          </Enlace>
        </Titulo>
      )}
      {!plegado && (
        <ul className="tarjetas-gasto" id={idCuerpo}>
          {grupo.items.map((i) =>
            i.tipo === "grupo" ? (
              <li key={i.id} className="subgrupo-gasto">
                <Grupo grupo={i} buscando={buscando} plegados={plegados} alternar={alternar} {...resto} />
              </li>
            ) : i.tipo === "equipo" ? (
              <TarjetaEquipo key={i.id} t={i} />
            ) : (
              <Tarjeta key={i.id} t={i} ocupado={resto.ocupados.has(i.id)} hoy={resto.hoy} onPagar={resto.onPagar} onRegistrar={resto.onRegistrar} />
            )
          )}
        </ul>
      )}
    </section>
  );
}

// Pantalla de Gastos, "¿Qué pagaste?": los tipos de gasto de la base como
// grupos con tarjetas. Lo que vence va primero.
export default function GastosInicio() {
  const provider = useDataProvider();
  const { abrirPago, avisar, refrescar, version } = useAcciones();
  const { categorias, cargando: cargandoTipos, error: errorTipos, recargar } = useGastos();
  const [datos, setDatos] = useState(null); // { pagos, totales }
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [plegados, setPlegados] = useState(() => new Set());
  const [ocupados, setOcupados] = useState(() => new Set());
  // Candado inmediato por tarjeta (ver lib/useCandado.js): `ocupados` se ve
  // recién en el próximo dibujo, la referencia se marca en el acto.
  const enCurso = useRef(new Set());
  const hoy = hoyArgentinaISO();

  useEffect(() => {
    let vigente = true;
    provider
      .listarPagosGasto()
      .then((r) => {
        if (!vigente) return;
        setDatos({ pagos: r.pagos, totales: r.totales });
        setError("");
      })
      .catch((err) => {
        if (vigente) setError(err.message || "No se pudieron cargar los pagos.");
      });
    return () => {
      vigente = false;
    };
  }, [provider, version]);

  const grupos = useMemo(() => (datos ? armarGrupos({ categorias, pagos: datos.pagos, hoy }) : []), [categorias, datos, hoy]);
  const visibles = useMemo(() => filtrarGrupos(grupos, busqueda), [grupos, busqueda]);
  const buscando = busqueda.trim() !== "";

  function alternar(id) {
    setPlegados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function marcarOcupado(id, ocupado) {
    if (ocupado) enCurso.current.add(id);
    else enCurso.current.delete(id);
    setOcupados(new Set(enCurso.current));
  }

  function registrar(t) {
    abrirPago({ categoriaId: t.id, periodo: t.periodo || undefined });
  }

  // "Pagué": un paso, con Deshacer. Sin un método recordado todavía (la primera
  // vez), se abre la ventana para elegirlo.
  async function pagar(t) {
    if (enCurso.current.has(t.id)) return;
    const metodo = leerUltimoMetodo();
    if (!metodo) return registrar(t);
    marcarOcupado(t.id, true);
    setError("");
    try {
      const pago = await provider.crearPagoGasto({
        categoria_id: t.id,
        fecha_pago: hoy,
        monto: t.monto,
        metodo_pago: metodo,
        ...(t.periodo ? { periodo: t.periodo } : {}),
      });
      refrescar();
      avisar(`Se registró el pago de ${t.nombre}.`, async () => {
        try {
          await provider.eliminarPagoGasto(pago.id);
        } catch (err) {
          avisar(err.message || "No se pudo deshacer el pago.");
        }
        refrescar();
      });
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
    } finally {
      marcarOcupado(t.id, false);
    }
  }

  const cargando = cargandoTipos || (!datos && !error);
  const falla = error || errorTipos;

  return (
    <>
      <div className="page-header">
        <div>
          <p>Lo que pagaste y lo que falta pagar. Lo que vence va primero.</p>
          {datos && (
            <p className="lbl">
              Este mes pagaste {formatoDolares(datos.totales.mes)} · en el año {formatoDolares(datos.totales.anio)}
            </p>
          )}
        </div>
      </div>

      {falla && (
        <div className="error-banner" role="alert">
          {falla}{" "}
          <button type="button" className="link-action" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      <div className="buscador">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un gasto"
          aria-label="Buscar un gasto"
        />
      </div>

      {cargando ? (
        <div className="card panel">
          <EsqueletoLista items={4} />
        </div>
      ) : grupos.length === 0 ? (
        <div className="card estado-vacio">
          <h3>Todavía no cargaste ningún gasto</h3>
          <p>Agregá el primero, por ejemplo “Wifi” que se repite cada mes. Después podés ordenarlos en carpetas.</p>
          <div className="estado-vacio-acciones">
            <Enlace href="/gastos/mis-gastos" className="btn-gold">
              Agregar mis gastos
            </Enlace>
          </div>
        </div>
      ) : visibles.length === 0 ? (
        <p className="lbl">Ningún gasto coincide con “{busqueda.trim()}”.</p>
      ) : (
        <div className="grupos-gasto">
          {visibles.map((g) => (
            <Grupo key={g.id} grupo={g} buscando={buscando} plegados={plegados} alternar={alternar} ocupados={ocupados} hoy={hoy} onPagar={pagar} onRegistrar={registrar} />
          ))}
        </div>
      )}

      <p className="gastos-pie">
        <Enlace href="/gastos/pagos" className="btn-ghost">
          Ver todos los pagos
        </Enlace>
        <Enlace href="/gastos/mis-gastos" className="btn-ghost">
          Mis gastos
        </Enlace>
      </p>
    </>
  );
}
