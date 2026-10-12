"use client";

import { useEffect } from "react";

// Script que corre antes de que React enganche los eventos: un clic en un botón
// o enlace en ese momento no hacía nada (se perdía en silencio). Se frena y se
// guarda el último; PaginaLista lo repite apenas la página está lista.
const CAPTURA = `
(function () {
  window.__clicTemprano = null;
  document.addEventListener("click", function (e) {
    if (document.documentElement.dataset.listo) return;
    var el = e.target && e.target.closest ? e.target.closest("button, a[href]") : null;
    if (!el || el.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    window.__clicTemprano = { el: el, en: Date.now() };
  }, true);
})();
`;

export function CapturaDeClics() {
  return <script dangerouslySetInnerHTML={{ __html: CAPTURA }} />;
}

// Marca el documento como listo cuando React ya enganchó los eventos y repite el
// clic que llegó antes (si fue hace poco y el elemento sigue ahí).
export default function PaginaLista() {
  useEffect(() => {
    document.documentElement.dataset.listo = "1";
    const pendiente = window.__clicTemprano;
    window.__clicTemprano = null;
    if (pendiente && pendiente.el.isConnected && Date.now() - pendiente.en < 5000) pendiente.el.click();
  }, []);
  return null;
}
