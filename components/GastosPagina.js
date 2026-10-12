"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { useDataProvider } from "../lib/dataProvider";
import { abrirComprobante } from "../lib/abrirComprobante";
import { aNombreDeArchivo, descargarCSV } from "../lib/csv";
import { fechaDMA, hoyArgentinaISO, mesLabel } from "../lib/fechas";
import { ES_RECURRENTE, SEPARADOR_RUTA, idsDelGrupo, nombresDeRuta } from "../lib/gastos";
import { useGastos } from "../lib/GastosContext";
import { formatoDolares } from "../lib/moneda";
import { fechaCorta } from "../lib/resumen";
import { ETIQUETA_METODO } from "../lib/metodoPago";
import Enlace from "./Enlace";
import { EsqueletoFilas, EsqueletoStats } from "./Esqueleto";
import { IconoLapiz } from "./Iconos";

const ESTADOS = { pagado: "Pagado", pendiente: "Pendiente", vencido: "Vencido", anterior: "Sin seguimiento" };
const TONO_ESTADO = { pagado: "ok", pendiente: "", vencido: "warn", anterior: "" };

function etiquetaPeriodo(categoria, periodo) {
  if (!periodo) return "";
  return categoria?.recurrencia === "anual" ? periodo.slice(0, 4) : mesLabel(periodo.slice(0, 7));
}

// Qué dice la tarjeta de estado de una categoría recurrente.
function textoEstado(categoria, estado, hoy) {
  const periodo = etiquetaPeriodo(categoria, estado.periodo);
  if (estado.estado === "pagado") {
    return `${periodo}: pagado el ${fechaDMA(estado.pago.fecha_pago)}`;
  }
  if (estado.estado === "anterior") {
    return `${periodo}: vencía el ${fechaCorta(estado.vencimiento)}, antes de empezar a usar el sistema`;
  }
  const cuando = estado.estado === "vencido" ? "venció" : estado.vencimiento === hoy ? "vence hoy" : "vence";
  return `${periodo}: ${cuando}${estado.vencimiento === hoy ? "" : ` el ${fechaCorta(estado.vencimiento)}`}`;
}

// Página de una categoría de gasto (y, sin `categoriaId`, de todos los pagos):
// historial (con las subcategorías si es un grupo), totales del mes y del año,
// y para las recurrentes el estado del período actual.
export default function GastosPagina({ categoriaId = null }) {
  const provider = useDataProvider();
  const { version, abrirPago, refrescar, avisar } = useAcciones();
  const { categorias, porId, cargando: cargandoCategorias } = useGastos();
  const categoria = categoriaId ? porId.get(categoriaId) || null : null;
  const hoy = hoyArgentinaISO();

  const [datos, setDatos] = useState(null); // { pagos, totales, estado, truncado }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(null); // id del pago en curso

  useEffect(() => {
    // Se espera a las categorías: sin ellas no se sabe si el id existe.
    if (categoriaId && !categoria) return undefined;
    let vigente = true;
    setCargando(true);
    setError("");
    provider
      .listarPagosGasto(categoriaId ? { categoria_id: categoriaId } : {})
      .then((r) => {
        if (vigente) setDatos(r);
      })
      .catch((err) => {
        if (vigente) {
          setDatos(null);
          setError(err.message || "Ocurrió un error de conexión.");
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [provider, categoriaId, categoria, version]);

  const esGrupo = useMemo(
    () => (categoria ? categorias.some((c) => c.parent_id === categoria.id) : !categoriaId),
    [categoria, categorias, categoriaId]
  );
  const subcategorias = categoria ? idsDelGrupo(categoria.id, categorias).length - 1 : 0;
  const hayRecurrentes = useMemo(() => (datos?.pagos ?? []).some((p) => ES_RECURRENTE(porId.get(p.categoria_id) || {})), [datos, porId]);

  const verComprobante = useCallback(
    async (pago) => {
      setError("");
      try {
        await abrirComprobante(provider, pago.id);
      } catch (err) {
        setError(err.message || "No se pudo abrir el comprobante.");
      }
    },
    [provider]
  );

  async function eliminar(pago) {
    const ok = window.confirm(
      `¿Eliminar el pago de ${formatoDolares(pago.monto)} del ${fechaDMA(pago.fecha_pago)} (${pago.categoria_nombre})?${
        pago.de_liquidacion
          ? " Es un pago al equipo: los encuentros o sesiones que pagaba vuelven a quedar sin pagar en la certificación (el módulo sigue cerrado) y se pagan con \"Pagar lo atrasado\"."
          : ""
      }${pago.tiene_comprobante ? " También se borra su comprobante." : ""} No se puede deshacer.`
    );
    if (!ok) return;
    setOcupado(pago.id);
    setError("");
    try {
      const r = await provider.eliminarPagoGasto(pago.id);
      refrescar();
      avisar(r?.aviso || "Se eliminó el pago.");
    } catch (err) {
      setError(err.message || "No se pudo eliminar el pago.");
    } finally {
      setOcupado(null);
    }
  }

  function exportar() {
    const columnas = [
      { label: "Fecha de pago", value: (p) => p.fecha_pago },
      { label: "Tipo de gasto", value: (p) => p.ruta },
      { label: "Mes", value: (p) => (p.periodo ? etiquetaPeriodo(porId.get(p.categoria_id), p.periodo) : "") },
      { label: "Proveedor", value: (p) => p.proveedor || "" },
      { label: "Descripción", value: (p) => p.descripcion || "" },
      { label: "Método de pago", value: (p) => ETIQUETA_METODO[p.metodo_pago] || "" },
      { label: "Monto (US$)", value: (p) => p.monto },
      { label: "Comprobante", value: (p) => (p.tiene_comprobante ? "Sí" : "No") },
    ];
    descargarCSV(`gastos-${categoria ? aNombreDeArchivo(categoria.nombre) : "todos"}-${hoy}.csv`, datos.pagos, columnas);
  }

  if (categoriaId && !categoria) {
    return cargandoCategorias ? (
      <EsqueletoStats />
    ) : (
      <div className="card estado-vacio">
        <h3>No encontramos ese tipo de gasto</h3>
        <p>Puede que se haya borrado o que el enlace esté mal escrito.</p>
        <div className="estado-vacio-acciones">
          <Enlace href="/gastos/pagos" className="btn-gold">
            Ver todos los pagos
          </Enlace>
        </div>
      </div>
    );
  }

  const subtitulo = categoria
    ? nombresDeRuta(categoria.id, porId).slice(0, -1).join(SEPARADOR_RUTA) || "Gastos"
    : "Todos los gastos";
  const titulo = categoria ? categoria.nombre : "Todos los pagos";
  const estado = datos?.estado ?? null;
  const pagos = datos?.pagos ?? [];
  // Sin categoría fija (grupo o todos) cada fila dice a cuál pertenece.
  const mostrarCategoria = esGrupo;
  const columnas = 5 + (mostrarCategoria ? 1 : 0) + (hayRecurrentes ? 1 : 0);

  return (
    <>
      <div className="page-header">
        <div>
          <p>{subtitulo}</p>
          {categoria && !categoria.activo && <p className="deuda-texto">Tipo de gasto desactivado</p>}
        </div>
        <div className="acciones">
          <button type="button" className="btn-gold" onClick={() => abrirPago(!esGrupo && categoria ? { categoriaId: categoria.id } : {})}>
            Registrar pago
          </button>
          <button type="button" className="btn-ghost" onClick={() => window.print()} disabled={pagos.length === 0}>
            Imprimir
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={exportar}
            disabled={pagos.length === 0}
            title="Se abre en Excel con columnas"
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="print-area">
        <div className="print-only">
          <h2>{titulo}</h2>
          <p>Generado el {fechaDMA(hoy)}</p>
        </div>

        {cargando ? (
          <EsqueletoStats />
        ) : datos ? (
          <div className="grid3">
            <div className="stat card">
              <p className="lbl">Pagado en {mesLabel(hoy.slice(0, 7)).toLowerCase()}</p>
              <p className="value">{formatoDolares(datos.totales.mes)}</p>
            </div>
            <div className="stat card">
              <p className="lbl">Pagado en {hoy.slice(0, 4)}</p>
              <p className="value">{formatoDolares(datos.totales.anio)}</p>
            </div>
            {estado ? (
              <div className="stat card">
                <p className="lbl">{categoria.recurrencia === "anual" ? "Gasto anual" : "Gasto mensual"}</p>
                <p className="value">
                  <span className={`pill ${TONO_ESTADO[estado.estado]}`} style={{ fontSize: "var(--t-base)" }}>
                    {ESTADOS[estado.estado]}
                  </span>
                </p>
                <p className="detalle">{textoEstado(categoria, estado, hoy)}</p>
                {categoria.monto_estimado != null && <p className="detalle">Monto habitual: {formatoDolares(categoria.monto_estimado)}</p>}
              </div>
            ) : (
              <div className="stat card">
                <p className="lbl">{esGrupo && categoria ? "Subtipos" : "Pagos registrados"}</p>
                <p className="value">{esGrupo && categoria ? subcategorias : pagos.length}</p>
                {datos.truncado && <p className="detalle">Se muestran los últimos {pagos.length}.</p>}
              </div>
            )}
          </div>
        ) : null}

        {!cargando && datos && pagos.length === 0 ? (
          <div className="card estado-vacio">
            <h3>Todavía no hay pagos {categoria ? `en ${categoria.nombre}` : "registrados"}</h3>
            <p>
              {esGrupo
                ? "Registrá el primero y elegí el tipo de gasto a la que corresponde."
                : "Registrá el primer pago: la fecha, el monto y, si querés, el comprobante."}
            </p>
            <div className="estado-vacio-acciones">
              <button type="button" className="btn-gold" onClick={() => abrirPago(!esGrupo && categoria ? { categoriaId: categoria.id } : {})}>
                Registrar pago
              </button>
            </div>
          </div>
        ) : (
          <div className="table-card card">
            <table className="apilable">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {mostrarCategoria && <th>Tipo de gasto</th>}
                  <th>Detalle</th>
                  {hayRecurrentes && <th>Mes</th>}
                  <th>Método</th>
                  <th>Monto (US$)</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargando && <EsqueletoFilas columnas={columnas} filas={4} />}
                {!cargando &&
                  pagos.map((p) => {
                    const detalle = [p.proveedor, p.descripcion].filter(Boolean).join(" · ");
                    return (
                      <tr key={p.id}>
                        <td data-label="Fecha">{fechaDMA(p.fecha_pago)}</td>
                        {mostrarCategoria && (
                          <td data-label="Tipo de gasto">
                            <Enlace className="link-action" href={`/gastos/${p.categoria_id}`}>
                              {categoria ? p.ruta.split(SEPARADOR_RUTA).slice(nombresDeRuta(categoria.id, porId).length).join(SEPARADOR_RUTA) || p.categoria_nombre : p.ruta}
                            </Enlace>
                          </td>
                        )}
                        <td data-label="Detalle">{detalle || <span className="celda-vacia">—</span>}</td>
                        {hayRecurrentes && (
                          <td data-label="Mes">
                            {p.periodo ? etiquetaPeriodo(porId.get(p.categoria_id), p.periodo) : <span className="celda-vacia">—</span>}
                          </td>
                        )}
                        <td data-label="Método">{ETIQUETA_METODO[p.metodo_pago] || <span className="celda-vacia">—</span>}</td>
                        <td data-label="Monto (US$)" className="num">
                          {formatoDolares(p.monto)}
                        </td>
                        <td>
                          <div className="row-actions">
                            {p.tiene_comprobante && (
                              <button type="button" className="link-action" onClick={() => verComprobante(p)}>
                                Comprobante
                              </button>
                            )}
                            {p.de_liquidacion && (
                              <span className="lbl" title="Lo generó un pago al equipo: el monto y la persona no se cambian">
                                Pago al equipo
                              </span>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => abrirPago({ pago: p })}
                              disabled={ocupado === p.id}
                              title="Editar pago"
                              aria-label={`Editar el pago de ${formatoDolares(p.monto)} del ${fechaDMA(p.fecha_pago)}`}
                            >
                              <IconoLapiz size={13} />
                            </button>
                            <button type="button" className="link-action danger" onClick={() => eliminar(p)} disabled={ocupado === p.id}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
