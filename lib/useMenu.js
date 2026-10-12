"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Estado de un menú desplegable: se cierra con Escape (devolviendo el foco al
// botón que lo abrió) y con un click afuera. `contenedor` envuelve al botón y
// al menú; `onKeyDownMenu` agrega las flechas para recorrer los ítems.
export function useMenu(selectorItems) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) contenedor.current?.querySelector("[aria-haspopup]")?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    function afuera(e) {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    }
    function teclado(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar(true);
      }
    }
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", teclado);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", teclado);
    };
  }, [abierto, cerrar]);

  // Al abrir, el foco pasa al primer ítem (o al seleccionado).
  useEffect(() => {
    if (!abierto) return;
    const items = contenedor.current?.querySelectorAll(selectorItems);
    const elegido = contenedor.current?.querySelector(`${selectorItems}[aria-selected="true"]`);
    (elegido || items?.[0])?.focus();
  }, [abierto, selectorItems]);

  function onKeyDownMenu(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...contenedor.current.querySelectorAll(selectorItems)];
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const siguiente = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[siguiente].focus();
  }

  return { abierto, setAbierto, cerrar, contenedor, onKeyDownMenu };
}
