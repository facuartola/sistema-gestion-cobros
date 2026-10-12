"use client";

import { useEffect, useMemo, useState } from "react";
import { formatoDolares } from "../../lib/moneda";
import { armarParaHacer } from "../../lib/paraHacer";
import { PERIODOS, textoVariacion, tonoVariacion } from "../../lib/panorama";
import { agendaProxima, armarPendientes, fechaCorta, fraseGastosPorPagar, mesCorto, mesLabelCorto } from "../../lib/resumen";
import { lista } from "../../lib/inicioDatos";
import { useRecordatoriosContext } from "../../lib/RecordatoriosContext";
import Anillo from "../panel/Anillo";
import BarrasAgrupadas from "../panel/BarrasAgrupadas";
import Histograma from "../panel/Histograma";
import { FilaPendiente, Movimientos, QuienDebe } from "../panel/Listas";
import { TarjetaKpi, TarjetaPanel } from "../panel/Tarjetas";
import Enlace from "../Enlace";
import ZonaDesplazable from "../ZonaDesplazable";
import { EsqueletoLista } from "../Esqueleto";
import { CLAVES_NAVEGADOR } from "../../lib/navegador";

// Bloques de Inicio. Cada uno recibe `c` (el contexto ya calculado por
// app/page.js, con valores por defecto seguros) y se dibuja dentro de su
// propio BloqueSeguro.

const COLORES_REPARTO = ["pn-c1", "pn-c2", "pn-c3", "pn-c4", "pn-c5", "pn-c6"];

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

const MES_ABREVIADO = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
// "5–11 oct" (o "28 oct–3 nov" si cruza de mes) para la semana de un gráfico.
export function rangoCorto(inicio, fin) {
  const f = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return { d, m: MES_ABREVIADO.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "") };
  };
  const a = f(inicio);
  const b = f(fin);
  return a.m === b.m ? `${a.d}–${b.d} ${a.m}` : `${a.d} ${a.m}–${b.d} ${b.m}`;
}

// Selector del tramo de los gráficos: un grupo de opciones, con teclado.
export function SelectorPeriodo({ valor, onChange }) {
  return (
    <div className="pn-periodo" role="radiogroup" aria-label="Tramo de los gráficos">
      {PERIODOS.map((p) => (
        <button key={p.clave} type="button" role="radio" aria-checked={valor === p.clave} className={`pn-periodo-op${valor === p.clave ? " on" : ""}`} onClick={() => onChange(p.clave)}>
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

// Leyenda de un reparto: una fila por segmento (se puede tocar o enfocar).
function LeyendaReparto({ filas, elegido, onElegir }) {
  return (
    <ul className="pn-leyenda-reparto">
      {filas.map((f) => (
        <li key={f.clave}>
          <button
            type="button"
            className={`pn-leyenda-fila${elegido === f.clave ? " on" : ""}`}
            aria-pressed={onElegir ? elegido === f.clave : undefined}
            disabled={!onElegir}
            onClick={() => onElegir?.(f.clave)}
          >
            <i className={`pn-punto-color ${f.claseFondo}`} aria-hidden="true" />
            <span className="pn-leyenda-nombre" title={f.nombre}>{f.nombre}</span>
            <span className="pn-leyenda-valor num">{f.valor}</span>
            <span className="pn-leyenda-sub lbl">{f.detalle}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- Vista "Hoy" -------------------------------------------------------------------------------

export function FraseInicio({ c }) {
  if (c.loading || !c.datos) return null;
  const { personas, estado, resumen } = c;
  const porCobrarN = personas.filter((p) => p.cuota_actual?.estado !== "pagado").length;
  const fraseCobros =
    porCobrarN === 0 ? "No te falta cobrar nada este mes" : `Te faltan cobrar ${formatoDolares(estado.porCobrar)} de ${plural(porCobrarN, "persona", "personas")}`;
  const { texto, sinMonto } = fraseGastosPorPagar(resumen?.gastosPorPagar);
  return (
    <p className="frase-principal pn-frase">
      {fraseCobros}
      {texto}.
      {sinMonto > 0 && (
        <>
          {" "}
          <Enlace href="/gastos" className="link-action">
            Cargar {sinMonto === 1 ? "el monto" : "los montos"}
          </Enlace>
        </>
      )}
    </p>
  );
}

export function TresNumeros({ c }) {
  const { loading, sinPanorama, ind, estado, nombreDelMes, tramo } = c;
  if (loading) {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card pn-kpi pn-hoy-num" aria-hidden="true" style={{ minHeight: 120 }} />
        ))}
      </>
    );
  }
  return (
    <>
      <TarjetaKpi
        className="pn-hoy-num"
        etiqueta="Por cobrar"
        valor={formatoDolares(estado.porCobrar)}
        detalle={
          estado.porCobrarN === 0
            ? "Todos al día"
            : `${plural(estado.porCobrarN, "persona", "personas")}${estado.atrasado.n > 0 ? `, ${plural(estado.atrasado.n, "atrasada", "atrasadas")}` : ""}`
        }
      />
      <TarjetaKpi
        className="pn-hoy-num"
        etiqueta="Cobrado del mes"
        valor={sinPanorama ? "—" : formatoDolares(ind.cobrado.valor)}
        variacion={sinPanorama ? null : { texto: textoVariacion(ind.cobrado.variacion), tono: tonoVariacion(ind.cobrado.variacion, true) }}
        detalle={tramo}
      />
      <TarjetaKpi
        className="pn-hoy-num"
        destacado
        etiqueta={`Resultado de ${nombreDelMes}`}
        valor={sinPanorama ? "—" : formatoDolares(ind.resultado.valor)}
        variacion={sinPanorama ? null : { texto: textoVariacion(ind.resultado.variacion), tono: tonoVariacion(ind.resultado.variacion, true) }}
        detalle="cobrado menos gastado"
      />
    </>
  );
}

export function ParaHacer({ c }) {
  const { personas, mesActual, resumen, loading, abrirCobro, abrirPago, avisar, enDemo } = c;
  const { recordatorios, grupos, hoy, loading: cargandoRecordatorios, toggleHecho } = useRecordatoriosContext();
  const [verTodo, setVerTodo] = useState(false);
  const [ocupados, setOcupados] = useState(() => new Set());
  // Se puede ocultar; la elección se recuerda en el navegador (nunca en /demo).
  const [oculto, setOcultoEstado] = useState(false);
  useEffect(() => {
    if (enDemo) return;
    try {
      setOcultoEstado(localStorage.getItem(CLAVES_NAVEGADOR.hacerOculto) === "1");
    } catch {
      // Sin localStorage queda visible.
    }
  }, [enDemo]);
  function setOculto(valor) {
    setOcultoEstado(valor);
    try {
      if (!enDemo) localStorage.setItem(CLAVES_NAVEGADOR.hacerOculto, valor ? "1" : "0");
    } catch {
      // Sin localStorage, dura mientras la app siga abierta.
    }
  }

  const buscarPersona = useMemo(() => {
    const porClave = new Map(personas.map((p) => [`${p.tipo}-${p.id}`, p]));
    return (r) => porClave.get(r.jugador_id ? `jugador-${r.jugador_id}` : r.alumno_id ? `alumno-${r.alumno_id}` : "") || null;
  }, [personas]);
  const pendientes = useMemo(
    () =>
      armarPendientes({
        personas,
        mes: mesActual,
        hoy,
        grupos,
        buscarPersona,
        gastos: resumen?.gastos ?? [],
        certificaciones: resumen?.certificaciones ?? [],
      }),
    [personas, mesActual, hoy, grupos, buscarPersona, resumen]
  );
  const proximos = useMemo(() => (resumen ? agendaProxima(resumen.proximos, recordatorios, hoy) : []), [resumen, recordatorios, hoy]);
  const paraHacer = useMemo(() => armarParaHacer({ pendientes, proximos, personas, hoy }), [pendientes, proximos, personas, hoy]);

  async function marcarHecho(item) {
    const r = item.recordatorio;
    if (ocupados.has(r.id)) return;
    setOcupados((s) => new Set(s).add(r.id));
    try {
      await toggleHecho(r);
      avisar(`Se marcó "${r.titulo}" como hecho.`, () => toggleHecho({ ...r, hecho: true }).catch(() => {}));
    } catch (err) {
      avisar(err.message || "No se pudo actualizar el recordatorio.");
    } finally {
      setOcupados((s) => {
        const n = new Set(s);
        n.delete(r.id);
        return n;
      });
    }
  }

  const cuenta = paraHacer.hoy.length + paraHacer.semana.length;
  const cargandoLista = loading || cargandoRecordatorios;
  // Se muestran las primeras 6 cosas (hoy primero); el resto, con "Ver las N".
  const LIMITE_LISTA = 6;
  const limite = verTodo ? Infinity : LIMITE_LISTA;
  const hoyVisible = paraHacer.hoy.slice(0, limite);
  const semanaVisible = paraHacer.semana.slice(0, Math.max(0, limite - hoyVisible.length));
  const listaDe = (filas) => (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {filas.map((item) => (
        <FilaPendiente
          key={item.clave}
          item={item}
          ocupado={item.recordatorio ? ocupados.has(item.recordatorio.id) : false}
          onCobrar={(i) => abrirCobro({ persona: i.persona, mes: mesActual })}
          onPagar={(i) => abrirPago({ categoriaId: i.gasto.id, periodo: i.gasto.periodo })}
          onHecho={marcarHecho}
        />
      ))}
    </ul>
  );
  const textoCuenta = cargandoLista ? "" : cuenta === 0 ? "Nada para hacer" : plural(cuenta, "cosa", "cosas");

  if (oculto) {
    return (
      <section className="card pn-hacer-plegado" aria-label="Para hacer">
        <h2 className="panel-titulo">Para hacer</h2>
        <span className="lbl" aria-live="polite">{textoCuenta}</span>
        <button type="button" className="btn-ghost btn-sm" aria-expanded="false" onClick={() => setOculto(false)}>
          Mostrar
        </button>
      </section>
    );
  }
  return (
    <section className="card pn-hacer" aria-label="Para hacer">
      <div className="lista-cabecera">
        <h2 className="panel-titulo">Para hacer</h2>
        <span className="lbl" aria-live="polite">{textoCuenta}</span>
        <button type="button" className="btn-ghost btn-sm" aria-expanded="true" onClick={() => setOculto(true)}>
          Ocultar
        </button>
      </div>
      <ZonaDesplazable className="pn-hacer-cuerpo" etiqueta="Lista de cosas para hacer">
        {cargandoLista ? (
          <div style={{ padding: "4px 24px 24px" }}>
            <EsqueletoLista items={4} />
          </div>
        ) : cuenta === 0 ? (
          <p className="vacio-lista">No tenés cobros atrasados, gastos por pagar ni recordatorios para esta semana.</p>
        ) : (
          <>
            {hoyVisible.length > 0 && (
              <>
                <h3 className="grupo-titulo">Hoy</h3>
                {listaDe(hoyVisible)}
              </>
            )}
            {semanaVisible.length > 0 && (
              <>
                <h3 className="grupo-titulo">Esta semana</h3>
                {listaDe(semanaVisible)}
              </>
            )}
            {cuenta > LIMITE_LISTA && (
              <div className="lista-pie">
                <button type="button" className="link-action" onClick={() => setVerTodo((v) => !v)}>
                  {verTodo ? "Ver menos" : `Ver las ${cuenta}`}
                </button>
              </div>
            )}
          </>
        )}
      </ZonaDesplazable>
    </section>
  );
}

export function QuienDebeBloque({ c }) {
  const { loading, debe, personas, mesActual, abrirCobro } = c;
  return (
    <TarjetaPanel
      className="pn-debe-c"
      titulo="Quién debe"
      subtitulo="Los clientes con deuda, de los más antiguos a los más nuevos"
      cargando={loading}
      altoEsqueleto={190}
      vacio={
        debe.total === 0
          ? {
              titulo: personas.length === 0 ? "Todavía no hay clientes cargados" : "Nadie está atrasado",
              detalle: personas.length === 0 ? "Cargá tus clientes para seguir sus cobros." : "Todos los clientes están al día.",
              accion: personas.length === 0 ? <Enlace href="/cobros" className="btn-ghost btn-sm">Ir a Cobros</Enlace> : null,
            }
          : null
      }
      resumen={`${plural(debe.total, "cliente con deuda", "clientes con deuda")}: ${debe.items.map((f) => `${f.persona.nombre} ${formatoDolares(f.monto)}`).join(", ")}.`}
    >
      <QuienDebe datos={debe} onCobrar={(persona) => abrirCobro({ persona, mes: mesActual })} />
    </TarjetaPanel>
  );
}

// --- Vista "Análisis" ----------------------------------------------------------------------------

export function Indicadores({ c }) {
  const { loading, sinPanorama, ind, estado, tasa, nombreDelMes, tramo } = c;
  if (loading) {
    return (
      <>
        {["pn-res", "pn-cob", "pn-gas", "pn-por", "pn-tasa"].map((k) => (
          <div key={k} className={`card pn-kpi ${k}`} aria-hidden="true" style={{ minHeight: 120 }} />
        ))}
      </>
    );
  }
  return (
    <>
      <TarjetaKpi
        className="pn-res"
        destacado
        etiqueta={`Resultado de ${nombreDelMes}`}
        valor={sinPanorama ? "—" : formatoDolares(ind.resultado.valor)}
        variacion={sinPanorama ? null : { texto: textoVariacion(ind.resultado.variacion), tono: tonoVariacion(ind.resultado.variacion, true) }}
        detalle={`cobrado menos gastado, ${tramo}`}
        tendencia={sinPanorama ? null : ind.resultado.tendencia}
        claseColor="pn-spark-oro"
      />
      <TarjetaKpi
        className="pn-cob"
        etiqueta="Cobrado del mes"
        valor={sinPanorama ? "—" : formatoDolares(ind.cobrado.valor)}
        variacion={sinPanorama ? null : { texto: textoVariacion(ind.cobrado.variacion), tono: tonoVariacion(ind.cobrado.variacion, true) }}
        detalle={tramo}
        tendencia={sinPanorama ? null : ind.cobrado.tendencia}
        claseColor="pn-spark-ok"
      />
      <TarjetaKpi
        className="pn-gas"
        etiqueta="Gastado del mes"
        valor={sinPanorama ? "—" : formatoDolares(ind.gastado.valor)}
        variacion={sinPanorama ? null : { texto: textoVariacion(ind.gastado.variacion), tono: tonoVariacion(ind.gastado.variacion, false) }}
        detalle={tramo}
        tendencia={sinPanorama ? null : ind.gastado.tendencia}
        claseColor="pn-spark-hueso"
      />
      <TarjetaKpi
        className="pn-por"
        etiqueta="Por cobrar"
        valor={formatoDolares(estado.porCobrar)}
        detalle={
          estado.porCobrarN === 0
            ? "Todos al día"
            : `${plural(estado.porCobrarN, "persona", "personas")}${estado.atrasado.n > 0 ? `, ${plural(estado.atrasado.n, "atrasada", "atrasadas")}` : ""}`
        }
        extra={
          estado.porCobrar > 0 ? (
            <div className="pn-minibarra" role="img" aria-label={`Atrasado ${formatoDolares(estado.atrasado.monto)} de ${formatoDolares(estado.porCobrar)}`}>
              <div className="pn-f-warn" style={{ width: `${pct(estado.atrasado.monto, estado.porCobrar)}%` }} />
              <div className="pn-f-hueso" style={{ width: `${100 - pct(estado.atrasado.monto, estado.porCobrar)}%` }} />
            </div>
          ) : null
        }
      />
      <TarjetaKpi
        className="pn-tasa"
        etiqueta="Tasa de cobranza"
        valor={tasa == null ? "—" : `${tasa} %`}
        detalle={tasa == null ? "Todavía no hay cuotas este mes" : `Pagaron ${formatoDolares(estado.pago.monto)} de ${formatoDolares(estado.esperado)}`}
        extra={
          tasa != null ? (
            <div className="progreso-barra pn-barra-tasa" role="img" aria-label={`${tasa} % de lo esperado`}>
              <div style={{ width: `${tasa}%` }} />
            </div>
          ) : null
        }
      />
    </>
  );
}

export function Principal({ c }) {
  const { loading, sinPanorama, serie, periodo, mesActual } = c;
  const datos = serie.map((s) => ({
    clave: s.mes,
    etiqueta: mesCorto(s.mes),
    etiquetaLarga: mesLabelCorto(s.mes),
    a: s.cobrado,
    b: s.gastado,
    linea: s.resultado,
  }));
  const sinMovimientos = serie.every((s) => s.cobrado === 0 && s.gastado === 0);
  const totalCobrado = serie.reduce((a, s) => a + s.cobrado, 0);
  const totalGastado = serie.reduce((a, s) => a + s.gastado, 0);
  return (
    <TarjetaPanel
      className="pn-principal"
      titulo="Ingresos y gastos"
      subtitulo={`${periodo === "anio" ? "Lo que va del año" : "Últimos 6 meses"}, con el resultado neto de cada mes`}
      cargando={loading}
      altoEsqueleto={320}
      vacio={sinPanorama || sinMovimientos ? { titulo: "Todavía no hay cobros ni gastos registrados", detalle: "Cuando registres tu primer cobro o pago, acá vas a ver cómo evoluciona cada mes." } : null}
      resumen={`De ${mesLabelCorto(serie[0]?.mes ?? mesActual)} a ${mesLabelCorto(serie.at(-1)?.mes ?? mesActual)} cobraste ${formatoDolares(totalCobrado)} y gastaste ${formatoDolares(totalGastado)}; el resultado fue ${formatoDolares(totalCobrado - totalGastado)}.`}
      tabla={{
        columnas: ["Mes", "Ingresos", "Gastos", "Resultado"],
        filas: serie.map((s) => [mesLabelCorto(s.mes), formatoDolares(s.cobrado), formatoDolares(s.gastado), formatoDolares(s.resultado)]),
      }}
      pie={
        <div className="pn-leyenda lbl" aria-hidden="true">
          <span><i className="pn-leyenda-oro" />Ingresos</span>
          <span><i className="pn-leyenda-hueso" />Gastos</span>
          <span><i className="pn-leyenda-linea" />Resultado</span>
        </div>
      }
    >
      <BarrasAgrupadas
        datos={datos}
        nombres={{ a: "Ingresos", b: "Gastos", linea: "Resultado" }}
        conLinea
        altura={320}
        ayuda={(d) => `${d.etiquetaLarga}: ingresos ${formatoDolares(d.a)}, gastos ${formatoDolares(d.b)}, resultado ${formatoDolares(d.linea)}`}
      />
    </TarjetaPanel>
  );
}

export function EstadoCobros({ c }) {
  const { loading, estado, nombreDelMes } = c;
  const segmentos = [
    { clave: "pago", nombre: "Pagó", n: estado.pago.n, monto: estado.pago.monto, claseColor: "pn-s-ok", claseFondo: "pn-f-ok" },
    { clave: "porVencer", nombre: "Por vencer", n: estado.porVencer.n, monto: estado.porVencer.monto, claseColor: "pn-s-suave", claseFondo: "pn-f-suave" },
    { clave: "atrasado", nombre: "Atrasado", n: estado.atrasado.n, monto: estado.atrasado.monto, claseColor: "pn-s-warn", claseFondo: "pn-f-warn" },
  ];
  return (
    <TarjetaPanel
      className="pn-estado"
      titulo={`Cobros de ${nombreDelMes}`}
      subtitulo="Cuántos pagaron, cuántos faltan y cuántos se atrasaron"
      cargando={loading}
      altoEsqueleto={190}
      vacio={estado.personas === 0 ? { titulo: "Todavía no hay clientes cargados", detalle: "Cargá tus jugadores y alumnos con su monto mensual para ver el estado de los cobros.", accion: <Enlace href="/cobros" className="btn-ghost btn-sm">Ir a Cobros</Enlace> } : null}
      resumen={`De ${plural(estado.personas, "cuota", "cuotas")} por ${formatoDolares(estado.esperado)}: ${plural(estado.pago.n, "pagó", "pagaron")}, ${estado.porVencer.n} por vencer y ${plural(estado.atrasado.n, "atrasada", "atrasadas")}.`}
      tabla={{ columnas: ["Estado", "Personas", "Monto"], filas: segmentos.map((s) => [s.nombre, String(s.n), formatoDolares(s.monto)]) }}
    >
      <div className="pn-reparto">
        <Anillo
          segmentos={segmentos.map((s) => ({ clave: s.clave, valor: s.monto, claseColor: s.claseColor }))}
          centroValor={formatoDolares(estado.esperado)}
          centroEtiqueta="esperado"
          ariaLabel={`Estado de los cobros de ${nombreDelMes}`}
        />
        <LeyendaReparto
          filas={segmentos.map((s) => ({
            clave: s.clave,
            nombre: s.nombre,
            valor: formatoDolares(s.monto),
            detalle: `${plural(s.n, "persona", "personas")} · ${pct(s.monto, estado.esperado)} %`,
            claseFondo: s.claseFondo,
          }))}
        />
      </div>
    </TarjetaPanel>
  );
}

export function GastosPorTipo({ c }) {
  const { loading, sinPanorama, porGrupo, periodo, frasePeriodo } = c;
  const [elegido, setElegido] = useState(null);
  const total = porGrupo.reduce((a, g) => a + g.total, 0);
  const grupoElegido = porGrupo.find((g) => g.clave === elegido) || null;
  const alElegir = (clave) => setElegido((a) => (a === clave ? null : clave));
  return (
    <TarjetaPanel
      className="pn-tipo"
      titulo="Gastos por tipo"
      subtitulo={`${PERIODOS.find((p) => p.clave === periodo)?.etiqueta}. Tocá un tipo para ver el detalle`}
      cargando={loading}
      altoEsqueleto={190}
      vacio={sinPanorama || porGrupo.length === 0 ? { titulo: `Todavía no hay gastos ${periodo === "mes" ? "este mes" : "en este tramo"}`, detalle: "Registrá un pago de gasto para ver cómo se reparte entre tus tipos de gasto.", accion: <Enlace href="/gastos" className="btn-ghost btn-sm">Ir a Gastos</Enlace> } : null}
      resumen={`En ${frasePeriodo} gastaste ${formatoDolares(total)}: ${porGrupo.map((g) => `${g.nombre} ${formatoDolares(g.total)}`).join(", ")}.`}
      tabla={{ columnas: ["Tipo", "Total", "Pagos"], filas: porGrupo.map((g) => [g.nombre, formatoDolares(g.total), String(g.cantidad)]) }}
    >
      <div className="pn-reparto">
        <Anillo
          segmentos={porGrupo.map((g, i) => ({ clave: g.clave, valor: g.total, claseColor: `pn-s-${COLORES_REPARTO[i % COLORES_REPARTO.length].slice(3)}` }))}
          centroValor={formatoDolares(total)}
          centroEtiqueta="gastado"
          elegido={elegido}
          onElegir={alElegir}
          ariaLabel="Reparto de los gastos por tipo"
        />
        <LeyendaReparto
          elegido={elegido}
          onElegir={alElegir}
          filas={porGrupo.map((g, i) => ({
            clave: g.clave,
            nombre: g.nombre,
            valor: formatoDolares(g.total),
            detalle: `${pct(g.total, total)} %`,
            claseFondo: `pn-f-${COLORES_REPARTO[i % COLORES_REPARTO.length].slice(3)}`,
          }))}
        />
      </div>
      {grupoElegido && (
        <div className="pn-detalle" aria-live="polite">
          <div className="pn-detalle-titulo">
            {grupoElegido.nombre}: {formatoDolares(grupoElegido.total)}
          </div>
          <ul>
            {grupoElegido.detalle.map((t) => (
              <li key={t.nombre}>
                <span>{t.nombre}</span>
                <span className="num">{formatoDolares(t.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TarjetaPanel>
  );
}

export function CobrosPorMetodo({ c }) {
  const { loading, sinPanorama, porMetodo, periodo, frasePeriodo } = c;
  const total = porMetodo.reduce((a, m) => a + m.total, 0);
  const claseMetodo = { efectivo: "pn-f-oro", transferencia: "pn-f-azul", sin_metodo: "pn-f-suave" };
  return (
    <TarjetaPanel
      className="pn-metodo"
      titulo="Cobros por método"
      subtitulo={PERIODOS.find((p) => p.clave === periodo)?.etiqueta}
      cargando={loading}
      altoEsqueleto={150}
      vacio={sinPanorama || porMetodo.length === 0 ? { titulo: `Todavía no hay cobros ${periodo === "mes" ? "este mes" : "en este tramo"}`, detalle: "Al registrar un cobro elegís si fue en efectivo o por transferencia." } : null}
      resumen={`En ${frasePeriodo} cobraste ${formatoDolares(total)}: ${porMetodo.map((m) => `${m.etiqueta} ${formatoDolares(m.total)}`).join(", ")}.`}
      tabla={{ columnas: ["Método", "Total", "Cobros"], filas: porMetodo.map((m) => [m.etiqueta, formatoDolares(m.total), String(m.cantidad)]) }}
    >
      <div className="pn-metodo-total num">{formatoDolares(total)}</div>
      <div className="pn-apilada" role="img" aria-label="Reparto de los cobros por método">
        {porMetodo.map((m) => (
          <div key={m.clave} className={claseMetodo[m.clave]} style={{ width: `${total > 0 ? (m.total / total) * 100 : 0}%` }} />
        ))}
      </div>
      <LeyendaReparto
        filas={porMetodo.map((m) => ({
          clave: m.clave,
          nombre: m.etiqueta,
          valor: formatoDolares(m.total),
          detalle: `${plural(m.cantidad, "cobro", "cobros")} · ${pct(m.total, total)} %`,
          claseFondo: claseMetodo[m.clave],
        }))}
      />
    </TarjetaPanel>
  );
}

export function CertificacionBloque({ c }) {
  const { certActiva, cargandoCert, avance, distSesiones, resumen } = c;
  if (!certActiva) return null;
  const cursoCert = resumen?.certificaciones?.[0] ?? null;
  const listos = avance.filter((a) => a.en_condiciones).length;
  return (
    <TarjetaPanel
      className="pn-cert"
      titulo={certActiva.nombre || "Certificación"}
      subtitulo="Alumnos según las sesiones que ya hicieron"
      cargando={cargandoCert}
      altoEsqueleto={170}
      vacio={avance.length === 0 ? { titulo: "Todavía no hay alumnos inscriptos", detalle: "Inscribí alumnos para ver su avance.", accion: <Enlace href="/certificacion" className="btn-ghost btn-sm">Ir a Certificación</Enlace> } : null}
      resumen={`${plural(avance.length, "alumno inscripto", "alumnos inscriptos")}; ${listos} listos para certificar. ${distSesiones.map((n, i) => (n > 0 ? `${n} con ${i} sesiones` : null)).filter(Boolean).join(", ")}.`}
      tabla={{ columnas: ["Sesiones hechas", "Alumnos"], filas: distSesiones.map((n, i) => [String(i), String(n)]) }}
    >
      <Histograma distribucion={distSesiones} />
      <ul className="pn-cert-datos">
        <li>
          <span className="lbl">Módulo</span>
          <b>{cursoCert ? (cursoCert.moduloEnCurso ? `${cursoCert.moduloEnCurso} en curso` : "Los 10 pagados") : "—"}</b>
        </li>
        <li>
          <span className="lbl">Listos para certificar</span>
          <b className="num">
            {listos} de {avance.length}
          </b>
        </li>
      </ul>
      <div className="pn-pie-lista">
        <Enlace href="/certificacion" className="link-action">
          Ver la certificación
        </Enlace>
      </div>
    </TarjetaPanel>
  );
}

export function Proyeccion({ c }) {
  const { loading, proy, nombreDelMes, ind, estado } = c;
  return (
    <section className="card pn-proy" aria-label="Proyección del mes">
      <h2 className="panel-titulo">Proyección del mes</h2>
      {loading ? (
        <div className="pn-esqueleto" aria-hidden="true">
          <EsqueletoLista items={2} />
        </div>
      ) : proy.ingresos === 0 && proy.egresos === 0 ? (
        <p className="lbl">Todavía no hay cobros ni gastos para proyectar el mes.</p>
      ) : (
        <>
          <p className="pn-proy-frase">
            Si todos pagan, cerrás {nombreDelMes} con {proy.cierre < 0 ? "una pérdida de " : ""}
            <b className={`num ${proy.cierre < 0 ? "pn-neg" : "pn-pos"}`}>{formatoDolares(Math.abs(proy.cierre))}</b>
            {proy.margenPct != null && proy.cierre >= 0 ? `, un margen del ${proy.margenPct} %` : ""}.
          </p>
          <p className="lbl">
            Ingresos esperados {formatoDolares(proy.ingresos)} (cobrado {formatoDolares(ind.cobrado.valor)} + por cobrar {formatoDolares(estado.porCobrar)}) menos gastos {formatoDolares(proy.egresos)}
            {proy.gastosSinMonto > 0 ? `, sin contar ${plural(proy.gastosSinMonto, "gasto sin monto cargado", "gastos sin monto cargado")}` : ""}.
          </p>
          {proy.gastosSinMonto > 0 && (
            <p className="lbl">
              <Enlace href="/gastos" className="link-action">
                Cargar los montos
              </Enlace>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function Proximos({ c }) {
  const { loading, prox } = c;
  return (
    <TarjetaPanel
      className="pn-prox"
      titulo="Próximos 30 días"
      subtitulo="Lo que esperás cobrar contra los gastos que vencen, por semana"
      cargando={loading}
      altoEsqueleto={170}
      vacio={!prox.hayAlgo ? { titulo: "No hay vencimientos en los próximos 30 días", detalle: "Cargá el día de vencimiento de tus clientes y de tus gastos fijos para verlos acá." } : null}
      resumen={`En los próximos 30 días esperás cobrar ${formatoDolares(prox.totalCobros)} y vencen gastos por ${formatoDolares(prox.totalGastos)}.`}
      tabla={{
        columnas: ["Semana", "A cobrar", "Gastos que vencen"],
        filas: prox.semanas.map((s) => [rangoCorto(s.inicio, s.fin), formatoDolares(s.cobros), formatoDolares(s.gastos)]),
      }}
      pie={
        <>
          <div className="pn-leyenda lbl" aria-hidden="true">
            <span><i className="pn-leyenda-oro" />A cobrar {formatoDolares(prox.totalCobros)}</span>
            <span><i className="pn-leyenda-hueso" />Gastos {formatoDolares(prox.totalGastos)}</span>
          </div>
          {prox.gastosSinMonto > 0 && (
            <p className="lbl pn-nota">
              {plural(prox.gastosSinMonto, "gasto vence", "gastos vencen")} sin monto cargado: no entra{prox.gastosSinMonto === 1 ? "" : "n"} en las barras.
            </p>
          )}
        </>
      }
    >
      <BarrasAgrupadas
        datos={prox.semanas.map((s) => ({
          clave: s.inicio,
          etiqueta: rangoCorto(s.inicio, s.inicio).replace(/–\d+/, ""),
          etiquetaLarga: `Semana del ${rangoCorto(s.inicio, s.fin)}`,
          a: s.cobros,
          b: s.gastos,
          linea: 0,
        }))}
        nombres={{ a: "A cobrar", b: "Gastos" }}
        altura={190}
        ayuda={(d) => `${d.etiquetaLarga}: a cobrar ${formatoDolares(d.a)}, gastos que vencen ${formatoDolares(d.b)}`}
      />
    </TarjetaPanel>
  );
}

export function UltimosMovimientos({ c }) {
  const { loading, resumen } = c;
  const movimientos = lista(resumen?.movimientos);
  return (
    <TarjetaPanel
      className="pn-mov"
      titulo="Últimos movimientos"
      subtitulo="Cobros y pagos, del más reciente al más viejo"
      cargando={loading}
      altoEsqueleto={190}
      vacio={!resumen || movimientos.length === 0 ? { titulo: resumen ? "Todavía no hay cobros ni pagos registrados" : "No se pudieron cargar los movimientos", detalle: resumen ? "Cuando registres un cobro o un pago, aparece acá." : undefined } : null}
      resumen={`Último movimiento: ${movimientos[0] ? `${movimientos[0].nombre}, ${fechaCorta(movimientos[0].fecha)}` : "ninguno"}.`}
    >
      <Movimientos items={movimientos} />
    </TarjetaPanel>
  );
}
