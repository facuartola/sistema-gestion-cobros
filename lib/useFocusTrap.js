import { useEffect } from "react";

const SELECTOR_FOCOSABLES = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Mantiene el foco de teclado (Tab / Shift+Tab) dentro de un contenedor
// mientras esté activo — pensado para modales, donde sin esto Tab se escapa
// hacia elementos de la página de atrás que quedaron visualmente tapados.
export function useFocusTrap(ref, activo) {
  useEffect(() => {
    if (!activo || !ref.current) return;
    const contenedor = ref.current;

    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      const focosables = Array.from(contenedor.querySelectorAll(SELECTOR_FOCOSABLES)).filter(
        (el) => el.offsetParent !== null
      );
      if (focosables.length === 0) return;
      const primero = focosables[0];
      const ultimo = focosables[focosables.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    contenedor.addEventListener("keydown", onKeyDown);
    return () => contenedor.removeEventListener("keydown", onKeyDown);
  }, [ref, activo]);
}
