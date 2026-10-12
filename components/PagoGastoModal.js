"use client";

import { useMemo, useRef, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { useDataProvider } from "../lib/dataProvider";
import { hoyArgentinaISO, mesLabel } from "../lib/fechas";
import { ES_RECURRENTE, carpetasPosibles, hojasActivas, indexar, periodoDe, periodosElegibles, textoRuta } from "../lib/gastos";
import { useGastos } from "../lib/GastosContext";
import { abrirComprobante } from "../lib/abrirComprobante";
import { COMPROBANTE, LIMITES_GASTO, parseMonto, validarCategoriaNueva, validarComprobante, validarEdicionPagoLiquidacion, validarPago } from "../lib/gastosValidacion";
import { OPCIONES_METODO, guardarUltimoMetodo, leerUltimoMetodo } from "../lib/metodoPago";
import { formatoDolares } from "../lib/moneda";
import { useCandado } from "../lib/useCandado";
import { CarpetaSelect, SeRepite } from "./TipoGastoCampos";
import Ventana from "./Ventana";

const NUEVO_TIPO = "__nuevo";

const ACEPTADOS = Object.keys(COMPROBANTE.tipos).join(",");

function etiquetaPeriodo(categoria, periodo) {
  return categoria.recurrencia === "anual" ? `Año ${periodo.slice(0, 4)}` : mesLabel(periodo.slice(0, 7));
}

// Ventana para registrar (o editar) el pago de un gasto. Se abre con:
//  - nada (desde "+ Nuevo" o la tecla G): hay que elegir la categoría;
//  - `categoriaId` (desde la página de una categoría) y, si viene de "Para hacer
//    hoy", el `periodo` que se está pagando;
//  - `pago` (editar uno existente).
// En las recurrentes el período se completa solo (el actual, o el que se pidió) y
// se puede cambiar para saldar un mes anterior. El monto se precarga con el
// estimado de la categoría. El comprobante es opcional; se valida tipo y tamaño
// antes de subirlo.
export default function PagoGastoModal({ inicial = {}, onClose, onGuardado }) {
  const provider = useDataProvider();
  const { categorias: delContexto } = useGastos();
  const { refrescar } = useAcciones();
  // Los tipos creados desde esta ventana se usan al instante, antes de que el
  // contexto de Gastos termine de releerlos.
  const [extras, setExtras] = useState([]);
  const categorias = useMemo(() => [...delContexto, ...extras.filter((x) => !delContexto.some((c) => c.id === x.id))], [delContexto, extras]);
  const porId = useMemo(() => indexar(categorias), [categorias]);
  const pago = inicial.pago || null;
  const editando = Boolean(pago);
  // Un pago de liquidación al equipo: el monto, la categoría y la persona los
  // define la liquidación; acá solo se cambian fecha, método, proveedor,
  // descripción y comprobante.
  const deLiquidacion = Boolean(pago?.de_liquidacion);
  const hoy = hoyArgentinaISO();

  // Las categorías donde se puede registrar: hojas activas, más la del pago que
  // se edita aunque ya no lo sea.
  const opciones = useMemo(() => {
    const hojas = hojasActivas(categorias);
    const propia = pago && !hojas.some((c) => c.id === pago.categoria_id) ? porId.get(pago.categoria_id) : null;
    return [...hojas, ...(propia ? [propia] : [])]
      .map((c) => ({ id: c.id, texto: textoRuta(c.id, porId) }))
      .sort((a, b) => a.texto.localeCompare(b.texto, "es"));
  }, [categorias, porId, pago]);

  // Una categoría que es un grupo no admite pagos: si llega una, se elige a mano.
  const [categoriaId, setCategoriaId] = useState(
    pago?.categoria_id || (opciones.some((o) => o.id === inicial.categoriaId) ? inicial.categoriaId : "")
  );
  const categoria = categoriaId ? porId.get(categoriaId) || null : null;

  const [fecha, setFecha] = useState(pago?.fecha_pago || hoy);
  const [monto, setMonto] = useState(() => {
    if (pago) return String(pago.monto);
    const c = opciones.some((o) => o.id === inicial.categoriaId) ? porId.get(inicial.categoriaId) : null;
    return c?.monto_estimado != null ? String(c.monto_estimado) : "";
  });
  const [montoTocado, setMontoTocado] = useState(editando);
  const [periodo, setPeriodo] = useState(pago?.periodo || inicial.periodo || "");
  const [metodo, setMetodo] = useState(pago?.metodo_pago || (editando ? null : leerUltimoMetodo()));
  const [proveedor, setProveedor] = useState(pago?.proveedor || "");
  const [descripcion, setDescripcion] = useState(pago?.descripcion || "");
  const [archivo, setArchivo] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [quitarActual, setQuitarActual] = useState(false);
  const [error, setError] = useState("");
  // Candado contra el doble envío (lib/useCandado.js): dos clics, o Enter repetido,
  // muy seguidos no guardan dos veces.
  const { ocupado: guardando, ejecutar } = useCandado();
  // "+ Crear un tipo nuevo": pide solo nombre, carpeta y si se repite, y sigue con el pago.
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPadre, setNuevoPadre] = useState("");
  const [nuevoRepite, setNuevoRepite] = useState("ninguna");
  // Guardar el monto como habitual: null = lo que sugiere el tipo (sí en los que se repiten).
  const [habitualElegido, setHabitualElegido] = useState(null);
  const [abriendo, setAbriendo] = useState(false);
  const entradaArchivo = useRef(null);

  const recurrente = Boolean(categoria && ES_RECURRENTE(categoria));
  const periodosPosibles = useMemo(() => {
    if (!categoria || !ES_RECURRENTE(categoria)) return [];
    const lista = periodosElegibles(categoria, hoy);
    for (const extra of [periodo, inicial.periodo, pago?.periodo]) if (extra && !lista.includes(extra)) lista.push(extra);
    return lista.sort().reverse();
  }, [categoria, hoy, periodo, inicial.periodo, pago?.periodo]);
  // Período elegido, o el actual si todavía no se tocó nada.
  const periodoEfectivo = recurrente ? (periodosPosibles.includes(periodo) ? periodo : periodoDe(categoria, hoy)) : "";

  function elegirCategoria(id) {
    if (id === NUEVO_TIPO) {
      setCreando(true);
      setError("");
      return;
    }
    setCreando(false);
    setCategoriaId(id);
    setPeriodo("");
    const c = porId.get(id);
    // El estimado de la categoría elegida, salvo que ya se haya escrito un monto.
    if (!montoTocado) setMonto(c?.monto_estimado != null ? String(c.monto_estimado) : "");
  }

  function elegirArchivo(e) {
    const elegido = e.target.files?.[0] || null;
    setQuitarActual(false);
    if (!elegido) {
      setArchivo(null);
      setErrorArchivo("");
      return;
    }
    const { error: motivo } = validarComprobante(elegido);
    if (motivo) {
      setErrorArchivo(motivo);
      setArchivo(null);
      e.target.value = "";
      return;
    }
    setErrorArchivo("");
    setArchivo(elegido);
  }

  async function verActual() {
    setAbriendo(true);
    setError("");
    try {
      await abrirComprobante(provider, pago.id);
    } catch (err) {
      setError(err.message || "No se pudo abrir el comprobante.");
    } finally {
      setAbriendo(false);
    }
  }

  const carpetasParaNuevo = useMemo(() => carpetasPosibles(null, categorias), [categorias]);

  async function crearTipo() {
    const destino = nuevoPadre || null;
    const cuerpo = { nombre: nuevoNombre, parent_id: destino, recurrencia: nuevoRepite };
    // Un gasto anual necesita el mes en que vence: por defecto, el de este pago (se cambia en Mis gastos).
    if (nuevoRepite === "anual") cuerpo.mes_vencimiento = Number((fecha || hoy).slice(5, 7));
    const { datos, error: invalido } = validarCategoriaNueva(cuerpo, categorias);
    if (invalido) return setError(invalido);
    setError("");
    try {
      const creada = await provider.crearCategoriaGasto({ ...datos, parent_id: destino });
      setExtras((previos) => [...previos, creada]);
      setCategoriaId(creada.id);
      setPeriodo("");
      setCreando(false);
      setNuevoNombre("");
      setNuevoPadre("");
      setNuevoRepite("ninguna");
      refrescar();
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
    }
  }

  async function guardar(e) {
    e.preventDefault();
    await ejecutar(() => (creando ? crearTipo() : guardarPago()));
  }

  async function guardarPago() {
    if (!categoria) return setError("Elegí el tipo de gasto.");
    const cuerpo = {
      categoria_id: categoria.id,
      fecha_pago: fecha,
      monto: monto.trim() === "" ? "" : monto,
      metodo_pago: metodo,
      proveedor,
      descripcion,
      ...(recurrente ? { periodo: periodoEfectivo } : {}),
    };
    const { datos, error: invalido } = deLiquidacion
      ? validarEdicionPagoLiquidacion({ fecha_pago: fecha, metodo_pago: metodo, proveedor, descripcion }, pago)
      : validarPago(cuerpo, categoria, hoy);
    if (invalido) return setError(invalido);

    setError("");
    let guardado;
    try {
      guardado = editando ? await provider.actualizarPagoGasto(pago.id, datos) : await provider.crearPagoGasto(datos);
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
      return;
    }

    // El pago ya quedó guardado. Con el comprobante pueden pasar dos cosas, y
    // en ninguna se pierde el pago: si falla, se avisa y se puede reintentar
    // desde "Editar".
    let avisoComprobante = "";
    try {
      if (archivo) await provider.subirComprobante(guardado.id, archivo);
      else if (quitarActual && pago?.tiene_comprobante) await provider.quitarComprobante(guardado.id);
    } catch (err) {
      avisoComprobante = `El pago se guardó, pero el comprobante no: ${err.message || "no se pudo subir"}. Podés agregarlo desde Editar.`;
    }
    if (!deLiquidacion || datos.metodo_pago) guardarUltimoMetodo(datos.metodo_pago ?? metodo);

    // Monto habitual para la próxima vez (solo si el tipo no tenía uno).
    let avisoExtra = "";
    if (ofrecerHabitual && guardarHabitual) {
      try {
        await provider.actualizarCategoriaGasto(categoria.id, { monto_estimado: datos.monto });
        avisoExtra = `Quedó ${formatoDolares(datos.monto)} como monto habitual de ${categoria.nombre}.`;
      } catch (err) {
        avisoExtra = `No se pudo guardar el monto habitual: ${err.message || "probá de nuevo desde Mis gastos"}.`;
      }
    }
    onGuardado({ pago: guardado, editando, avisoComprobante, avisoExtra });
  }

  const estimado = categoria?.monto_estimado;
  // Ofrecer guardar el monto como habitual: pago nuevo de un tipo que no tiene monto habitual.
  const montoValido = parseMonto(monto).valor != null;
  const ofrecerHabitual = !editando && !deLiquidacion && Boolean(categoria) && categoria.monto_estimado == null && montoValido;
  const guardarHabitual = habitualElegido ?? recurrente;

  return (
    <Ventana titulo={editando ? "Editar pago" : "Registrar pago"} onClose={onClose} bloqueada={guardando} formulario={guardar} ancho={480}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {deLiquidacion && (
        <p className="notice-banner" role="note">
          Es un pago al equipo: el monto y el tipo de gasto no se cambian. Si están mal, eliminá el pago y volvé a pagar al equipo.
        </p>
      )}

      <label className="field">
        <span>Tipo de gasto</span>
        <select value={creando ? NUEVO_TIPO : categoriaId} onChange={(e) => elegirCategoria(e.target.value)} disabled={guardando || deLiquidacion} autoFocus={!categoriaId}>
          <option value="">Elegí un tipo de gasto…</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.texto}
            </option>
          ))}
          {!deLiquidacion && !editando && <option value={NUEVO_TIPO}>+ Crear un tipo nuevo</option>}
        </select>
      </label>

      {creando && (
        <fieldset className="tipo-nuevo">
          <legend>Tipo nuevo</legend>
          <label className="field">
            <span>Nombre</span>
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={LIMITES_GASTO.nombreCategoria} autoFocus disabled={guardando} placeholder="Ej: Contador" />
          </label>
          <CarpetaSelect valor={nuevoPadre} onChange={setNuevoPadre} carpetas={carpetasParaNuevo} deshabilitado={guardando} />
          <SeRepite valor={nuevoRepite} onChange={setNuevoRepite} deshabilitado={guardando} />
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setCreando(false)} disabled={guardando}>
              Volver
            </button>
            <button type="submit" className="btn-gold" disabled={guardando}>
              {guardando ? "Creando…" : "Crear y seguir con el pago"}
            </button>
          </div>
        </fieldset>
      )}

      {!creando && (
        <>
      {recurrente && !deLiquidacion && (
        <label className="field">
          <span>{categoria.recurrencia === "anual" ? "Año que cubre" : "Mes que cubre"}</span>
          <select value={periodoEfectivo} onChange={(e) => setPeriodo(e.target.value)} disabled={guardando}>
            {periodosPosibles.map((p) => (
              <option key={p} value={p}>
                {etiquetaPeriodo(categoria, p)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Monto (US$)</span>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            setMontoTocado(true);
          }}
          autoFocus={Boolean(categoriaId) && !deLiquidacion}
          disabled={guardando || deLiquidacion}
        />
        {estimado != null && <small>Monto habitual de este gasto: {formatoDolares(estimado)}</small>}
      </label>

      {ofrecerHabitual && (
        <label className="check-habitual">
          <input type="checkbox" checked={guardarHabitual} onChange={(e) => setHabitualElegido(e.target.checked)} disabled={guardando} />
          <span>Guardar {formatoDolares(parseMonto(monto).valor)} como monto habitual de este gasto, para la próxima vez</span>
        </label>
      )}

      <label className="field">
        <span>Fecha del pago</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
      </label>

      <div className="field" role="radiogroup" aria-label="Cómo se pagó">
        <span>Cómo se pagó</span>
        <div className="opciones">
          {OPCIONES_METODO.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="radio"
              aria-checked={metodo === m.valor}
              className={`opcion${metodo === m.valor ? " elegida" : ""}`}
              onClick={() => setMetodo(m.valor)}
              disabled={guardando}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Proveedor, opcional</span>
        <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={LIMITES_GASTO.proveedor} disabled={guardando} />
      </label>

      <label className="field">
        <span>Descripción, opcional</span>
        <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={LIMITES_GASTO.descripcion} disabled={guardando} />
      </label>

      <div className="field">
        <span>Comprobante, opcional</span>
        {editando && pago.tiene_comprobante && !archivo && (
          <div className="comprobante-actual">
            {quitarActual ? (
              <span className="lbl">Se va a quitar el comprobante al guardar.</span>
            ) : (
              <span className="lbl">Ya tiene un comprobante cargado.</span>
            )}
            <button type="button" className="link-action" onClick={verActual} disabled={abriendo || guardando}>
              {abriendo ? "Abriendo…" : "Ver"}
            </button>
            <button type="button" className="link-action" onClick={() => setQuitarActual((q) => !q)} disabled={guardando}>
              {quitarActual ? "No quitar" : "Quitar"}
            </button>
          </div>
        )}
        <input
          ref={entradaArchivo}
          type="file"
          accept={ACEPTADOS}
          onChange={elegirArchivo}
          disabled={guardando}
          aria-label="Comprobante, opcional"
          aria-describedby="comprobante-ayuda"
        />
        <small id="comprobante-ayuda">
          {editando && pago.tiene_comprobante ? "Si elegís otro archivo, reemplaza al actual. " : ""}
          Foto (JPG, PNG o WebP) o PDF, hasta 5 MB.
        </small>
        {errorArchivo && (
          <small className="error-texto" role="alert">
            {errorArchivo}
          </small>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={guardando}>
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar pago"}
        </button>
      </div>
        </>
      )}
    </Ventana>
  );
}
