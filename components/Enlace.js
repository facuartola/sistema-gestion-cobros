"use client";

import Link from "next/link";
import { useNavegacion } from "../lib/NavContext";

// Enlace interno. En la app real es un <Link> de Next (sin recargar la
// página); en /demo frena la navegación del navegador y le pide el cambio de
// pestaña al contexto, así los datos de ejemplo en memoria no se pierden.
export default function Enlace({ href, onClick, children, ...resto }) {
  const { interceptar, ir } = useNavegacion();
  if (!interceptar) {
    return (
      <Link href={href} onClick={onClick} {...resto}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        ir(href);
      }}
      {...resto}
    >
      {children}
    </a>
  );
}
