"use client";

import { useCallback } from "react";
import { useAcciones } from "./AccionesContext";
import { useCertificacion } from "./CertificacionContext";
import { moduloParaRegistrar } from "./certificacionPagina";
import { useNavegacion } from "./NavContext";

// "Registré una clase o sesión": lleva al módulo en curso con su planilla abierta
// (ahí se marcan las clases dadas y las sesiones). Si todavía no hay ninguna
// certificación o todos los módulos están pagados, abre la ventana de sesiones.
export function useRegistrarClase() {
  const { abrirSesion } = useAcciones();
  const { resumen } = useCertificacion();
  const { ir } = useNavegacion();
  return useCallback(() => {
    const modulo = moduloParaRegistrar(resumen?.modulos);
    if (modulo) ir(`/certificacion/modulos/${modulo.modulo_id}`);
    else abrirSesion();
  }, [resumen, ir, abrirSesion]);
}
