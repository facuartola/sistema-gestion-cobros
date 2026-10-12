"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AccionesContext, mesesDisponibles } from "../lib/AccionesContext";
import { useDataProvider } from "../lib/dataProvider";
import { mesArgentinaISO } from "../lib/fechas";
import ClienteModal from "./ClienteModal";
import { GastosProvider } from "../lib/GastosContext";
import { CertificacionProvider } from "../lib/CertificacionContext";
import MarcarSesionModal from "./MarcarSesionModal";
import PagoGastoModal from "./PagoGastoModal";
import Paleta from "./Paleta";
import RecordatorioModal from "./RecordatorioModal";
import RegistrarCobroModal from "./RegistrarCobroModal";
import Toast from "./Toast";
import { CLAVES_NAVEGADOR } from "../lib/navegador";


function leerMesGuardado() {
  try {
    const guardado = sessionStorage.getItem(CLAVES_NAVEGADOR.mesElegido);
    return guardado && mesesDisponibles().includes(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

function escribiendoEnUnCampo(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// Lo que se comparte en toda la app una vez adentro:
//  - el mes elegido, que se recuerda entre pantallas;
//  - las acciones globales (registrar cobro, nuevo cliente, recordatorio,
//    buscador) con sus ventanas, y los atajos de teclado;
//  - un contador `version` que sube cuando algo cambia, para que las pantallas
//    recarguen sus datos sin que cada una sepa de las demás;
//  - el aviso (toast) global.
export default function AccionesProvider({ usuario = null, persistirMes = true, children }) {
  const provider = useDataProvider();
  const [mes, setMesState] = useState(() => mesArgentinaISO());
  const [version, setVersion] = useState(0);
  const [cobro, setCobro] = useState(null); // { persona?, mes? }
  const [pagoGasto, setPagoGasto] = useState(null); // { categoriaId?, periodo?, pago? }
  const [sesionAbierta, setSesionAbierta] = useState(null); // { inscripcionId? }
  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [recordatorioAbierto, setRecordatorioAbierto] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [busquedaPendiente, setBusquedaPendiente] = useState(null); // { tipo, nombre }

  // Se lee el mes guardado después de montar (no en el estado inicial) para
  // que el primer render coincida siempre con el del servidor.
  useEffect(() => {
    if (!persistirMes) return;
    const guardado = leerMesGuardado();
    if (guardado) setMesState(guardado);
  }, [persistirMes]);

  const setMes = useCallback(
    (nuevo) => {
      setMesState(nuevo);
      if (!persistirMes) return;
      try {
        sessionStorage.setItem(CLAVES_NAVEGADOR.mesElegido, nuevo);
      } catch {
        // Sin sessionStorage el mes se recuerda igual mientras la app siga abierta.
      }
    },
    [persistirMes]
  );

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);
  const avisar = useCallback((mensaje, onDeshacer) => setAviso({ mensaje, onDeshacer }), []);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  const abrirCobro = useCallback((opciones = {}) => setCobro(opciones), []);
  const abrirPago = useCallback((opciones = {}) => setPagoGasto(opciones), []);
  const abrirSesion = useCallback((opciones = {}) => setSesionAbierta(opciones), []);
  const abrirCliente = useCallback(() => setClienteAbierto(true), []);
  const abrirRecordatorio = useCallback(() => setRecordatorioAbierto(true), []);
  const abrirPaleta = useCallback(() => setPaletaAbierta(true), []);
  const consumirBusqueda = useCallback(() => setBusquedaPendiente(null), []);

  // Ctrl+K / Cmd+K abre el buscador desde cualquier lado; C, G, N, R y S abren las
  // acciones, pero solo si no se está escribiendo y no hay otra ventana abierta.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAbierta((a) => !a);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (escribiendoEnUnCampo(document.activeElement) || escribiendoEnUnCampo(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "c") abrirCobro();
      else if (tecla === "g") abrirPago();
      else if (tecla === "s") abrirSesion();
      else if (tecla === "n") abrirCliente();
      else if (tecla === "r") abrirRecordatorio();
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abrirCobro, abrirPago, abrirSesion, abrirCliente, abrirRecordatorio]);

  function alCobrar({ persona, mes: mesCobrado, previo }) {
    setCobro(null);
    refrescar();
    avisar(`Se registró el cobro de ${persona.nombre}.`, async () => {
      try {
        await provider.guardarCuota(persona.tipo, persona.id, {
          mes: `${mesCobrado}-01`,
          monto: previo.monto,
          estado: previo.estado,
          ...(previo.estado === "pagado" ? { fecha_pago: previo.fecha_pago, metodo_pago: previo.metodo_pago ?? null } : {}),
        });
      } catch (err) {
        avisar(err.message || "No se pudo deshacer el cobro.");
      }
      refrescar();
    });
  }

  function alGuardarPago({ pago, editando, avisoComprobante, avisoExtra }) {
    setPagoGasto(null);
    refrescar();
    avisar(avisoComprobante || `${editando ? "Se actualizó" : "Se registró"} el pago de ${pago.categoria_nombre}.${avisoExtra ? ` ${avisoExtra}` : ""}`);
  }

  function alMarcarSesion({ alumno, modulo }) {
    setSesionAbierta(null);
    refrescar();
    avisar(`Se marcó la sesión del módulo ${modulo} de ${alumno} como realizada.`);
  }

  function alGuardarCliente(_tipo, nombre) {
    setClienteAbierto(false);
    refrescar();
    avisar(`Se agregó a ${nombre}.`);
  }

  function alCrearRecordatorio(nuevo) {
    setRecordatorioAbierto(false);
    avisar(`Se creó el recordatorio "${nuevo.titulo}".`);
  }

  const valor = useMemo(
    () => ({
      usuario,
      mes,
      setMes,
      version,
      refrescar,
      avisar,
      abrirCobro,
      abrirPago,
      abrirSesion,
      abrirCliente,
      abrirRecordatorio,
      abrirPaleta,
      busquedaPendiente,
      pedirBusqueda: setBusquedaPendiente,
      consumirBusqueda,
    }),
    [
      usuario,
      mes,
      setMes,
      version,
      refrescar,
      avisar,
      abrirCobro,
      abrirPago,
      abrirSesion,
      abrirCliente,
      abrirRecordatorio,
      abrirPaleta,
      busquedaPendiente,
      consumirBusqueda,
    ]
  );

  return (
    <AccionesContext.Provider value={valor}>
      <GastosProvider>
        <CertificacionProvider persistir={persistirMes}>
          {children}
          {cobro && <RegistrarCobroModal inicial={cobro} onClose={() => setCobro(null)} onGuardado={alCobrar} />}
          {pagoGasto && <PagoGastoModal inicial={pagoGasto} onClose={() => setPagoGasto(null)} onGuardado={alGuardarPago} />}
          {sesionAbierta && <MarcarSesionModal inicial={sesionAbierta} onClose={() => setSesionAbierta(null)} onGuardado={alMarcarSesion} />}
          {clienteAbierto && (
            <ClienteModal tipoInicial="jugador" onClose={() => setClienteAbierto(false)} onSaved={alGuardarCliente} />
          )}
          {recordatorioAbierto && (
            <RecordatorioModal onClose={() => setRecordatorioAbierto(false)} onCreado={alCrearRecordatorio} />
          )}
          {paletaAbierta && <Paleta onClose={() => setPaletaAbierta(false)} />}
          {aviso && <Toast mensaje={aviso.mensaje} onDeshacer={aviso.onDeshacer} onCerrar={cerrarAviso} />}
        </CertificacionProvider>
      </GastosProvider>
    </AccionesContext.Provider>
  );
}

