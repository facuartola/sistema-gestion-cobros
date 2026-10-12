"use client";

import { useEffect, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { armarCuerpoCliente } from "../lib/clienteFormulario";
import { estadoDeCobro, porcentajeAbonado, textoDeuda } from "../lib/cobros";
import { useDataProvider } from "../lib/dataProvider";
import { fechaDMA, hoyArgentinaISO, mesLabel } from "../lib/fechas";
import { ETIQUETA_METODO, guardarUltimoMetodo, leerUltimoMetodo } from "../lib/metodoPago";
import { formatoDolares } from "../lib/moneda";
import { useCandado } from "../lib/useCandado";
import { LIMITES } from "../lib/validacion";
import Enlace from "./Enlace";
import PanelLateral from "./PanelLateral";

// Panel con TODO lo que se puede cambiar de un cliente (jugador o alumno):
// sus datos, la cuota del mes, lo que debe y lo que pagó, y darlo de baja.
// Cada bloque se guarda por separado y con candado contra el doble clic.
export default function PanelCliente({ persona, tipo, mes, onClose }) {
  const provider = useDataProvider();
  const { refrescar, avisar, version } = useAcciones();
  const esAlumno = tipo === "alumno";

  // --- Datos del cliente ---------------------------------------------------
  const [nombre, setNombre] = useState(persona.nombre ?? "");
  const [contacto, setContacto] = useState(persona.contacto ?? "");
  const [notas, setNotas] = useState(persona.notas ?? "");
  const [montoMensual, setMontoMensual] = useState(persona.monto_mensual != null ? String(persona.monto_mensual) : "");
  const [dia, setDia] = useState(persona.dia_vencimiento != null ? String(persona.dia_vencimiento) : "");
  const [montoTotal, setMontoTotal] = useState(persona.monto_total != null ? String(persona.monto_total) : "");
  const [errorDatos, setErrorDatos] = useState("");
  const datos = useCandado();

  // --- Cuota del mes -------------------------------------------------------
  const cuota = persona.cuota_actual;
  const [estado, setEstado] = useState(cuota?.estado || "pendiente");
  const [montoCuota, setMontoCuota] = useState(String(cuota?.monto ?? persona.monto_mensual ?? ""));
  const [fechaPago, setFechaPago] = useState(cuota?.fecha_pago || "");
  const [metodo, setMetodo] = useState(cuota?.metodo_pago || "");
  const [errorCuota, setErrorCuota] = useState("");
  const cuotaCandado = useCandado();

  // --- Baja ----------------------------------------------------------------
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState("");
  const baja = useCandado();

  // --- Últimas cuotas ------------------------------------------------------
  const [historial, setHistorial] = useState(null); // null = cargando
  const [errorHistorial, setErrorHistorial] = useState("");
  useEffect(() => {
    let vigente = true;
    provider
      .listarCuotas(tipo, persona.id, { limite: 6 })
      .then((r) => {
        if (vigente) {
          setHistorial(r);
          setErrorHistorial("");
        }
      })
      .catch((err) => {
        if (vigente) setErrorHistorial(err.message || "No se pudieron cargar las últimas cuotas.");
      });
    return () => {
      vigente = false;
    };
  }, [provider, tipo, persona.id, version]);

  const ocupado = datos.ocupado || cuotaCandado.ocupado || baja.ocupado;
  const actual = estadoDeCobro(persona, mes);
  const deuda = textoDeuda(persona.meses_adeudados);

  function guardarDatos(e) {
    e.preventDefault();
    return datos.ejecutar(async () => {
      const { body, error } = armarCuerpoCliente({ nombre, montoMensual, montoTotal, dia, contacto, notas, esAlumno });
      if (error) return setErrorDatos(error);
      setErrorDatos("");
      try {
        await provider.actualizarPersona(tipo, persona.id, body);
        refrescar();
        avisar(`Se guardaron los datos de ${body.nombre}.`);
      } catch (err) {
        setErrorDatos(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  function guardarCuota(e) {
    e.preventDefault();
    return cuotaCandado.ejecutar(async () => {
      const importe = Number(montoCuota);
      if (montoCuota.trim() === "" || !Number.isFinite(importe) || importe < 0) {
        return setErrorCuota("El monto de la cuota tiene que ser un número válido.");
      }
      const pagada = estado === "pagado";
      if (pagada && !fechaPago) return setErrorCuota("Indicá la fecha en que se cobró.");
      setErrorCuota("");
      const previa = {
        mes: `${mes}-01`,
        monto: Number(cuota?.monto ?? persona.monto_mensual ?? importe),
        estado: cuota?.estado || "pendiente",
        ...(cuota?.estado === "pagado" ? { fecha_pago: cuota.fecha_pago, metodo_pago: cuota.metodo_pago ?? null } : {}),
      };
      try {
        await provider.guardarCuota(tipo, persona.id, {
          mes: `${mes}-01`,
          monto: importe,
          estado,
          ...(pagada ? { fecha_pago: fechaPago, metodo_pago: metodo || null } : {}),
        });
        if (pagada && metodo) guardarUltimoMetodo(metodo);
        refrescar();
        avisar(`Se guardó la cuota de ${mesLabel(mes).toLowerCase()} de ${persona.nombre}.`, () =>
          provider.guardarCuota(tipo, persona.id, previa).then(refrescar, (err) => avisar(err.message || "No se pudo deshacer."))
        );
      } catch (err) {
        setErrorCuota(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  function cambiarEstado(nuevo) {
    setEstado(nuevo);
    if (nuevo === "pagado") {
      if (!fechaPago) setFechaPago(hoyArgentinaISO());
      if (!metodo) setMetodo(leerUltimoMetodo() || "");
    }
  }

  function darDeBaja() {
    return baja.ejecutar(async () => {
      setErrorBaja("");
      try {
        await provider.actualizarPersona(tipo, persona.id, { activo: false });
        refrescar();
        onClose();
        avisar(`Se dio de baja a ${persona.nombre}.`, () =>
          provider.actualizarPersona(tipo, persona.id, { activo: true }).then(refrescar, (err) => avisar(err.message || "No se pudo deshacer."))
        );
      } catch (err) {
        setErrorBaja(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <PanelLateral titulo={persona.nombre} subtitulo={esAlumno ? "Alumno de la certificación" : "Jugador"} onClose={onClose} bloqueado={ocupado}>
      <section className="panel-bloque panel-resumen" aria-label="Resumen">
        <div>
          <p className="lbl">Cuota de {mesLabel(mes).toLowerCase()}</p>
          <span className={`badge ${actual.tono}`}>{actual.texto}</span>
        </div>
        {deuda && (
          <div>
            <p className="lbl">Deuda acumulada</p>
            <span className="deuda-texto">{deuda}</span>
          </div>
        )}
        <div>
          <p className="lbl">Cobrado este año</p>
          <span>{formatoDolares(persona.total_anio || 0)}</span>
        </div>
        {esAlumno && persona.monto_total ? (
          <div className="panel-ancho">
            <p className="lbl">
              Abonado: {formatoDolares(persona.total_abonado || 0)} de {formatoDolares(persona.monto_total)}
            </p>
            <div className={`progreso-barra${Number(persona.total_abonado) >= Number(persona.monto_total) ? " completo" : ""}`}>
              <div style={{ width: `${porcentajeAbonado(persona.total_abonado, persona.monto_total)}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      <form className="panel-bloque" onSubmit={guardarDatos} noValidate>
        <h3>Datos</h3>
        {errorDatos && (
          <div className="error-banner" role="alert">
            {errorDatos}
          </div>
        )}
        <label className="field">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={datos.ocupado} />
        </label>
        <label className="field">
          <span>Contacto</span>
          <input
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            maxLength={LIMITES.contacto}
            placeholder="Teléfono, mail o cómo prefiere que le escriba"
            disabled={datos.ocupado}
          />
        </label>
        <label className="field">
          <span>Notas</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} disabled={datos.ocupado} />
        </label>
        <label className="field">
          <span>Monto mensual (US$)</span>
          <input type="number" min="1" inputMode="decimal" value={montoMensual} onChange={(e) => setMontoMensual(e.target.value)} disabled={datos.ocupado} />
          <small>Aplica a las cuotas nuevas; las ya cargadas conservan su monto.</small>
        </label>
        <label className="field">
          <span>Día del mes en que debe pagar (1 a 31)</span>
          <input type="number" min="1" max="31" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} disabled={datos.ocupado} />
        </label>
        {esAlumno && (
          <label className="field">
            <span>Monto total a abonar (US$)</span>
            <input
              type="number"
              min="1"
              inputMode="decimal"
              value={montoTotal}
              onChange={(e) => setMontoTotal(e.target.value)}
              placeholder="Vacío = pago mensual sin techo"
              disabled={datos.ocupado}
            />
          </label>
        )}
        <button type="submit" className="btn-gold" disabled={datos.ocupado}>
          {datos.ocupado ? "Guardando…" : "Guardar datos"}
        </button>
      </form>

      <form className="panel-bloque" onSubmit={guardarCuota} noValidate>
        <h3>Cuota de {mesLabel(mes).toLowerCase()}</h3>
        {errorCuota && (
          <div className="error-banner" role="alert">
            {errorCuota}
          </div>
        )}
        <div className="field" role="radiogroup" aria-label="Estado de la cuota">
          <span>Estado</span>
          <div className="opciones">
            {[
              ["pendiente", "Todavía no pagó"],
              ["pagado", "Pagó"],
            ].map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={estado === valor}
                className={`opcion${estado === valor ? " elegida" : ""}`}
                onClick={() => cambiarEstado(valor)}
                disabled={cuotaCandado.ocupado}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Monto de la cuota (US$)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={montoCuota} onChange={(e) => setMontoCuota(e.target.value)} disabled={cuotaCandado.ocupado} />
        </label>
        {estado === "pagado" && (
          <>
            <label className="field">
              <span>Fecha de pago</span>
              <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} disabled={cuotaCandado.ocupado} />
            </label>
            <label className="field">
              <span>Cómo pagó</span>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)} disabled={cuotaCandado.ocupado}>
                <option value="">Sin indicar</option>
                {Object.entries(ETIQUETA_METODO).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="submit" className="btn-gold" disabled={cuotaCandado.ocupado}>
          {cuotaCandado.ocupado ? "Guardando…" : "Guardar cuota"}
        </button>
      </form>

      <section className="panel-bloque" aria-label="Últimas cuotas">
        <h3>Últimas cuotas</h3>
        {errorHistorial ? (
          <p className="lbl">{errorHistorial}</p>
        ) : historial === null ? (
          <p className="lbl">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="lbl">Todavía no hay cuotas cargadas.</p>
        ) : (
          <ul className="panel-cuotas">
            {historial.map((c) => (
              <li key={c.mes}>
                <span>{mesLabel(c.mes.slice(0, 7))}</span>
                <span className="num">{formatoDolares(c.monto)}</span>
                <span className={`badge ${c.estado === "pagado" ? "pagado" : "pendiente"}`}>
                  {c.estado === "pagado"
                    ? `Pagó el ${fechaDMA(c.fecha_pago)}${c.metodo_pago ? `, ${ETIQUETA_METODO[c.metodo_pago].toLowerCase()}` : ""}`
                    : "No pagó"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-bloque panel-pie" aria-label="Otras acciones">
        <Enlace
          className="btn-ghost"
          href={`/recordatorios?persona_tipo=${tipo}&persona_id=${persona.id}&persona_nombre=${encodeURIComponent(persona.nombre)}`}
          onClick={onClose}
        >
          Crear un recordatorio
        </Enlace>
        {confirmandoBaja ? (
          <div className="panel-confirmacion" role="alertdialog" aria-label="Confirmar la baja">
            {errorBaja && (
              <div className="error-banner" role="alert">
                {errorBaja}
              </div>
            )}
            <p>¿Dar de baja a {persona.nombre}? Ya no va a aparecer en la lista (no se borra el historial).</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmandoBaja(false)} disabled={baja.ocupado}>
                No, dejarlo
              </button>
              <button type="button" className="btn-gold" onClick={darDeBaja} disabled={baja.ocupado}>
                {baja.ocupado ? "Dando de baja…" : "Sí, dar de baja"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost panel-baja" onClick={() => setConfirmandoBaja(true)} disabled={ocupado}>
            Dar de baja
          </button>
        )}
      </section>
    </PanelLateral>
  );
}
