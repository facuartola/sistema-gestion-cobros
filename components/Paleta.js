"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { useGastos } from "../lib/GastosContext";
import { useCertificacion } from "../lib/CertificacionContext";
import { aplanarEnlaces, normalizar } from "../lib/navegacion";
import { useNavegacion } from "../lib/NavContext";
import { useFocusTrap } from "../lib/useFocusTrap";
import { usePersonasActivas } from "../lib/usePersonasActivas";

const RUTA_POR_TIPO = { jugador: "/cobros?tipo=jugador", alumno: "/cobros?tipo=alumno" };
const ETIQUETA_TIPO = { jugador: "Jugador", alumno: "Alumno" };

// Buscador de personas y secciones (Ctrl+K o Cmd+K). Flechas para moverse,
// Enter para abrir, Escape para cerrar. Una persona lleva a su tabla con el
// nombre ya puesto en el buscador de la página.
export default function Paleta({ onClose }) {
  const { personasActivas, loading } = usePersonasActivas();
  const { ir } = useNavegacion();
  const { pedirBusqueda } = useAcciones();
  const { nav } = useGastos();
  const { resumen } = useCertificacion();
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const idLista = useId();
  const ref = useRef(null);
  const listaRef = useRef(null);
  useFocusTrap(ref, true);

  useEffect(() => {
    const previo = document.activeElement;
    return () => {
      if (previo && typeof previo.focus === "function" && document.contains(previo)) previo.focus();
    };
  }, []);

  const items = useMemo(() => {
    const q = normalizar(texto);
    // Las categorías de gasto se buscan por su nombre o por el de su grupo
    // ("Gastos variables"); en el detalle se ve el camino completo.
    const enlaces = aplanarEnlaces(nav).filter(
      (e) => !q || normalizar(e.etiqueta).includes(q) || normalizar(e.grupo).includes(q) || normalizar(e.camino).includes(q)
    );
    const categorias = enlaces
      .filter((e) => e.id.startsWith("gasto-"))
      .map((e) => ({ clave: `s-${e.id}`, grupo: "Tipos de gasto", nombre: e.etiqueta, detalle: e.camino || "Gastos", href: e.href }));
    const secciones = enlaces
      .filter((e) => !e.id.startsWith("gasto-"))
      .map((e) => ({ clave: `s-${e.id}`, grupo: "Secciones", nombre: e.etiqueta, detalle: e.grupo || "", href: e.href }));
    const personas = (q ? personasActivas.filter((p) => normalizar(p.nombre).includes(q)) : personasActivas)
      .slice(0, q ? 8 : 5)
      .map((p) => ({
        clave: `p-${p.tipo}-${p.id}`,
        grupo: "Personas",
        nombre: p.nombre,
        detalle: ETIQUETA_TIPO[p.tipo],
        persona: p,
      }));
    // Certificación elegida: personas del equipo, alumnos inscriptos y módulos.
    const coincide = (t) => !q || normalizar(t).includes(q);
    const certificacion = resumen
      ? [
          ...resumen.equipo
            .filter((p) => coincide(p.nombre))
            .map((p) => ({ clave: `e-${p.id}`, grupo: "Equipo", nombre: p.nombre, detalle: p.activo ? "Equipo" : "Equipo, desactivada", href: `/certificacion/equipo/${p.id}` })),
          ...resumen.avance
            .filter((a) => q && coincide(a.alumno))
            .map((a) => ({
              clave: `i-${a.inscripcion_id}`,
              grupo: "Alumnos inscriptos",
              nombre: a.alumno,
              detalle: `${a.sesiones_realizadas} de ${a.sesiones_totales} sesiones`,
              href: `/certificacion/alumnos/${a.inscripcion_id}`,
            })),
          ...resumen.modulos
            .filter((m) => q && coincide(`modulo ${m.numero}`))
            .map((m) => ({ clave: `m-${m.modulo_id}`, grupo: "Módulos", nombre: `Módulo ${m.numero}`, detalle: resumen.certificacion.nombre, href: `/certificacion/modulos/${m.modulo_id}` })),
        ].slice(0, q ? 12 : 4)
      : [];
    return [...secciones, ...categorias, ...certificacion, ...personas];
  }, [texto, personasActivas, nav, resumen]);

  const activo = Math.min(indice, Math.max(items.length - 1, 0));

  useEffect(() => {
    listaRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activo, items]);

  function abrir(item) {
    if (!item) return;
    onClose();
    if (item.persona) {
      pedirBusqueda({ tipo: item.persona.tipo, nombre: item.persona.nombre });
      ir(RUTA_POR_TIPO[item.persona.tipo]);
    } else {
      ir(item.href);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setIndice((activo + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      abrir(items[activo]);
    }
  }

  let grupoAnterior = null;
  return (
    <div
      className="paleta-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="paleta glass" role="dialog" aria-modal="true" aria-label="Buscar persona, tipo de gasto o sección">
        <input
          className="paleta-entrada"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-activedescendant={items[activo] ? `${idLista}-${items[activo].clave}` : undefined}
          aria-autocomplete="list"
          placeholder="Buscar persona, tipo de gasto o sección"
          aria-label="Buscar persona, tipo de gasto o sección"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setIndice(0);
          }}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <ul className="paleta-lista" id={idLista} role="listbox" ref={listaRef} aria-label="Resultados">
          {items.map((item, i) => {
            const encabezado = item.grupo !== grupoAnterior;
            grupoAnterior = item.grupo;
            return (
              <li key={item.clave} role="presentation">
                {encabezado && <div className="paleta-grupo">{item.grupo}</div>}
                <div
                  id={`${idLista}-${item.clave}`}
                  role="option"
                  aria-selected={i === activo}
                  className={`mi${i === activo ? " activo" : ""}`}
                  onMouseMove={() => i !== activo && setIndice(i)}
                  onClick={() => abrir(item)}
                >
                  <span>{item.nombre}</span>
                  <span className="lbl">{item.detalle}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {items.length === 0 && (
          <p className="paleta-vacio" role="status">
            {loading ? "Cargando personas…" : `Nada coincide con “${texto.trim()}”.`}
          </p>
        )}
        <div className="paleta-pie" aria-hidden="true">
          <span>↑ ↓ para moverte</span>
          <span>Enter para abrir</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
}
