"use client";

import { usePersonasActivas } from "../lib/usePersonasActivas";
import RecordatorioForm from "./RecordatorioForm";
import Ventana from "./Ventana";

// Alta de un recordatorio desde cualquier pantalla ("+ Nuevo" o la tecla R).
// Es el mismo formulario de /recordatorios, dentro de una ventana.
export default function RecordatorioModal({ onClose, onCreado }) {
  const { personasActivas } = usePersonasActivas();
  return (
    <Ventana titulo="Nuevo recordatorio" onClose={onClose} ancho={480}>
      <RecordatorioForm personas={personasActivas} prefill={null} onCreado={onCreado} onCancelar={onClose} enVentana />
    </Ventana>
  );
}
