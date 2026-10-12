"use client";

import { createContext, useContext } from "react";
import { mesArgentinaISO } from "./fechas";
import { mesesHasta } from "./resumen";

// Contexto de las acciones globales y del mes elegido. El proveedor con sus
// ventanas vive en components/AccionesProvider.js; esto queda aparte para que
// las ventanas puedan leer el contexto sin importarse en círculo.
export const AccionesContext = createContext(null);

// Los últimos 6 meses, el más nuevo primero. Es lo que se puede elegir.
export function mesesDisponibles() {
  return mesesHasta(mesArgentinaISO(), 6).reverse();
}

export function useAcciones() {
  const ctx = useContext(AccionesContext);
  if (!ctx) throw new Error("useAcciones debe usarse dentro de <AccionesProvider>");
  return ctx;
}
