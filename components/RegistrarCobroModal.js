"use client";

import { useEffect, useRef, useState } from "react";
import { useDataProvider } from "../lib/dataProvider";
import { hoyArgentinaISO, mesArgentinaISO, mesLabel } from "../lib/fechas";
import { OPCIONES_METODO, guardarUltimoMetodo, leerUltimoMetodo } from "../lib/metodoPago";
import { formatoDolares } from "../lib/moneda";
import { nombreMes } from "../lib/resumen";
import { mesesDisponibles } from "../lib/AccionesContext";
import { usePersonasActivas } from "../lib/usePersonasActivas";
import Avatar from "./Avatar";
import PersonaSelect from "./PersonaSelect";
import Ventana from "./Ventana";

// Ventana para registrar un cobro. Dos formas de abrirla:
//  - con `inicial.persona` y `inicial.mes` (desde "Para hacer hoy"): ya se sabe
//    a quién y qué cuota; solo se confirma monto, fecha y método;
//  - sin nada (desde "+ Nuevo" o la tecla C): se elige persona y mes, y se
//    busca la cuota de ese mes para precargar el monto y avisar si ya estaba
//    pagada.
// El método (efectivo o transferencia) es obligatorio: se guarda en
// metodo_pago de la cuota.
export default function RegistrarCobroModal({ inicial, onClose, onGuardado }) {
  const provider = useDataProvider();
  const fija = Boolean(inicial?.persona);
  const { personasActivas } = usePersonasActivas();

  const [persona, setPersona] = useState(fija ? inicial.persona : null);
  const [mes, setMes] = useState(inicial?.mes || mesArgentinaISO());
  const [monto, setMonto] = useState(() => {
    if (!fija) return "";
    return String(inicial.persona.cuota_actual?.monto ?? inicial.persona.monto_mensual);
  });
  const [fecha, setFecha] = useState(hoyArgentinaISO());
  const [metodo, setMetodo] = useState(() => leerUltimoMetodo());
  const [cuota, setCuota] = useState(fija ? inicial.persona.cuota_actual || null : null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Candado contra el doble envío: `guardando` deshabilita el botón recién en
  // el próximo dibujo, y dos clics (o Enter repetido) muy seguidos entraban los
  // dos. La referencia se marca en el acto.
  const enviando = useRef(false);
  const cache = useRef(new Map());

  // Sin persona fija: al elegir persona o mes se busca la cuota de ese mes.
  useEffect(() => {
    if (fija || !persona) return undefined;
    let vigente = true;
    async function buscar() {
      setBuscando(true);
      try {
        const clave = `${persona.tipo}-${mes}`;
        if (!cache.current.has(clave)) cache.current.set(clave, await provider.listarPersonas(persona.tipo, { mes }));
        if (!vigente) return;
        const fila = cache.current.get(clave).find((p) => p.id === persona.id);
        setCuota(fila?.cuota_actual || null);
        setMonto(String(fila?.cuota_actual?.monto ?? fila?.monto_mensual ?? ""));
        setError("");
      } catch (err) {
        if (vigente) setError(err.message || "No se pudo buscar la cuota de ese mes.");
      } finally {
        if (vigente) setBuscando(false);
      }
    }
    buscar();
    return () => {
      vigente = false;
    };
  }, [fija, persona, mes, provider]);

  async function guardar(e) {
    e.preventDefault();
    if (guardando || enviando.current) return;
    const importe = Number(monto);
    if (!persona) return setError("Elegí a quién le cobraste.");
    if (monto.trim() === "" || !Number.isFinite(importe) || importe <= 0) {
      return setError("El monto tiene que ser un número mayor a 0.");
    }
    if (!fecha) return setError("Indicá la fecha en que se cobró.");
    if (!metodo) return setError("Elegí cómo te pagaron: efectivo o transferencia.");

    setGuardando(true);
    enviando.current = true;
    setError("");
    const previo = {
      estado: cuota?.estado || "pendiente",
      monto: Number(cuota?.monto ?? persona.monto_mensual ?? importe),
      fecha_pago: cuota?.fecha_pago || undefined,
      metodo_pago: cuota?.metodo_pago ?? null,
    };
    try {
      await provider.guardarCuota(persona.tipo, persona.id, {
        mes: `${mes}-01`,
        monto: importe,
        estado: "pagado",
        fecha_pago: fecha,
        metodo_pago: metodo,
      });
      guardarUltimoMetodo(metodo);
      onGuardado({ persona, mes, previo });
    } catch (err) {
      setError(err.message || "Ocurrió un error de conexión.");
      setGuardando(false);
      enviando.current = false;
    }
  }

  const yaPagada = cuota?.estado === "pagado";

  return (
    <Ventana titulo="Registrar cobro" onClose={onClose} bloqueada={guardando} formulario={guardar}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {fija ? (
        <div className="resumen-cobro">
          <Avatar nombre={persona.nombre} />
          <div>
            <div>{persona.nombre}</div>
            <div className="lbl">Cuota de {nombreMes(mes)}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <span>Quién pagó</span>
            <PersonaSelect
              personas={personasActivas}
              valor={persona}
              onChange={(p) => {
                setPersona(p);
                setCuota(null);
                setMonto("");
              }}
              disabled={guardando}
              autoFocus
            />
          </div>
          <label className="field">
            <span>Mes de la cuota</span>
            <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={guardando}>
              {mesesDisponibles().map((m) => (
                <option key={m} value={m}>
                  {mesLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {yaPagada && (
            <p className="notice-banner" role="status">
              Esta cuota ya figura como pagada. Si guardás, se actualizan los datos del cobro.
            </p>
          )}
        </>
      )}

      <label className="field">
        <span>Monto cobrado (US$)</span>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          disabled={guardando || buscando}
          autoFocus={fija}
        />
        {fija && cuota?.monto != null && <small>Cuota del mes: {formatoDolares(cuota.monto)}</small>}
      </label>

      <label className="field">
        <span>Fecha del cobro</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} />
      </label>

      <div className="field" role="radiogroup" aria-label="Cómo te pagaron">
        <span>Cómo te pagaron</span>
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

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={guardando || buscando}>
          {guardando ? "Guardando…" : "Registrar cobro"}
        </button>
      </div>
    </Ventana>
  );
}
