"use client";

import { useEffect, useState } from "react";
import { useDataProvider } from "../../lib/dataProvider";
import { hoyArgentinaISO } from "../../lib/fechas";
import { formatoDolares } from "../../lib/moneda";
import { resumenLiquidacion } from "../../lib/certificacion";
import { validarLiquidacion } from "../../lib/certificacionValidacion";
import { useCandado } from "../../lib/useCandado";
import { OPCIONES_METODO } from "../../lib/metodoPago";
import Enlace from "../Enlace";
import Ventana from "../Ventana";
import { TablaLiquidacion } from "./comun";

// Confirmación de un pago al equipo (de un módulo o lo atrasado): muestra el
// detalle por persona, pide fecha (hoy por defecto) y método (obligatorio) y
// avisa que se crean pagos en Gastos. Después muestra lo creado con enlaces a
// Gastos. Con el candado de doble clic: mientras procesa no se puede volver a
// confirmar (la base además impide pagar dos veces un módulo).
//   confirmar({ fecha_pago, metodo_pago }) -> { creados, pagos }
export default function PagarEquipoModal({ titulo, filas, explicacion, equipo = [], confirmar, onClose, onTerminado }) {
  const [fecha, setFecha] = useState(hoyArgentinaISO());
  const [metodo, setMetodo] = useState(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const candado = useCandado();
  const procesando = candado.ocupado;
  const resumen = resumenLiquidacion(filas);
  const conPago = filas.filter((f) => f.total > 0).length;

  function enviar(e) {
    e.preventDefault();
    return candado.ejecutar(async () => {
      if (resultado) return;
      const { datos, error: invalido } = validarLiquidacion({ fecha_pago: fecha, metodo_pago: metodo }, hoyArgentinaISO());
      if (invalido) return setError(invalido);
      setError("");
      try {
        const r = await confirmar(datos);
        setResultado(r);
        onTerminado?.(r);
      } catch (err) {
        setError(err.message || "No se pudo pagar. Probá de nuevo en un momento.");
      }
    });
  }

  const nombreDe = (id) => equipo.find((p) => p.id === id)?.nombre ?? "";

  if (resultado) {
    return (
      <Ventana titulo={titulo} onClose={onClose} ancho={560}>
        <p className="notice-banner" role="status">
          {resultado.creados === 0
            ? "No había nada para pagar: no se creó ningún pago."
            : `Listo: se ${resultado.creados === 1 ? "creó 1 pago" : `crearon ${resultado.creados} pagos`} en Gastos.`}
        </p>
        {resultado.pagos.length > 0 && (
          <ul className="lista-simple">
            {resultado.pagos.map((p) => (
              <li key={p.id}>
                <span>
                  {nombreDe(p.equipo_id)} · <span className="lbl">{p.descripcion}</span>
                </span>
                <Enlace href={`/gastos/${p.categoria_id}`} className="link-action num" onClick={onClose}>
                  {formatoDolares(p.monto)}
                </Enlace>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <Enlace href="/gastos/pagos" className="btn-ghost" onClick={onClose}>
            Ver en Gastos
          </Enlace>
          <button type="button" className="btn-gold" onClick={onClose}>
            Listo
          </button>
        </div>
      </Ventana>
    );
  }

  return (
    <Ventana titulo={titulo} onClose={onClose} bloqueada={procesando} formulario={enviar} ancho={560}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {explicacion && <p className="lbl" style={{ marginBottom: 12 }}>{explicacion}</p>}
      <TablaLiquidacion filas={filas} vacio="No hay nada para pagar." />

      <p className="notice-banner" role="note">
        {resumen.faltaTarifa
          ? "Falta definir una tarifa: no se puede pagar todavía."
          : conPago === 0
            ? "No se va a crear ningún pago."
            : `Se van a crear ${conPago === 1 ? "1 pago" : `${conPago} pagos`} en Gastos (Pago de sesiones y Pago de encuentros) por ${formatoDolares(resumen.total)}, y lo pagado quedará bloqueado.`}
      </p>

      <label className="field">
        <span>Fecha de pago</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={procesando} />
      </label>

      <div className="field" role="radiogroup" aria-label="Cómo vas a pagar">
        <span>Cómo vas a pagar</span>
        <div className="opciones">
          {OPCIONES_METODO.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="radio"
              aria-checked={metodo === m.valor}
              className={`opcion${metodo === m.valor ? " elegida" : ""}`}
              onClick={() => setMetodo(m.valor)}
              disabled={procesando}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={procesando}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={procesando || resumen.faltaTarifa}>
          {procesando ? "Pagando…" : "Confirmar el pago"}
        </button>
      </div>
    </Ventana>
  );
}

// "Pagar al equipo" de un módulo: lee el detalle actual del módulo (lo hecho y
// no pagado de ese módulo y los anteriores) y abre la confirmación.
export function PagarModuloModal({ modulo, onClose, onTerminado }) {
  const provider = useDataProvider();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    provider
      .obtenerModulo(modulo.modulo_id)
      .then((r) => vigente && setDatos(r))
      .catch((err) => vigente && setError(err.message || "No se pudo cargar el detalle del pago."));
    return () => {
      vigente = false;
    };
  }, [provider, modulo.modulo_id]);

  const titulo = `Pagar al equipo: Módulo ${modulo.numero}`;
  if (!datos) {
    return (
      <Ventana titulo={titulo} onClose={onClose} ancho={560}>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : (
          <p className="lbl">Buscando lo que hay que pagar…</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </Ventana>
    );
  }
  return (
    <PagarEquipoModal
      titulo={titulo}
      explicacion="Al confirmar se crean los pagos en Gastos, lo pagado queda bloqueado y el módulo se cierra. Un módulo se paga una sola vez."
      filas={datos.liquidacion}
      equipo={datos.equipo}
      confirmar={(d) => provider.liquidarModulo(modulo.modulo_id, d)}
      onTerminado={onTerminado}
      onClose={onClose}
    />
  );
}
