"use client";

import { useNavegacion } from "../lib/NavContext";
import CopiaSeguridad from "./CopiaSeguridad";
import Enlace from "./Enlace";

// Configuración: lo que no se usa todos los días.
export default function ConfiguracionPagina() {
  const { interceptar } = useNavegacion(); // true dentro de /demo
  const opciones = [
    { href: "/gastos/mis-gastos", titulo: "Mis gastos", texto: "Agregar, renombrar, mover, ordenar o desactivar tus gastos y definir cuáles se repiten cada mes o una vez al año." },
    { href: "/errores", titulo: "Errores del sistema", texto: "Si algo falla, queda anotado acá. Sirve para avisarle a quien mantiene el sistema." },
    ...(interceptar ? [] : [{ href: "/demo", titulo: "Modo demo", texto: "Un recorrido con datos de ejemplo, para mostrar el sistema sin tocar tus datos." }]),
  ];
  const exportaciones = [
    { href: "/cobros", texto: "Cuotas de jugadores y de alumnos (Exportar a Excel, en el menú ⋯ de Cobros)" },
    { href: "/gastos/pagos", texto: "Todos los pagos de gastos (Exportar a Excel)" },
    { href: "/certificacion", texto: "Pagos al equipo (Certificación › Configurar › Exportar los pagos al equipo) y avance de alumnos (Certificación › Alumnos › ⋯)" },
  ];
  return (
    <>
      <div className="page-header">
        <p>Lo que no se usa todos los días.</p>
      </div>
      <div className="grid-tipos-gasto">
        {opciones.map((o) => (
          <Enlace key={o.href} href={o.href} className="card config-tarjeta">
            <span className="config-titulo">{o.titulo}</span>
            <span className="lbl">{o.texto}</span>
          </Enlace>
        ))}
      </div>
      <CopiaSeguridad />
      <section className="card config-exportar" aria-label="Exportaciones">
        <h2 className="panel-titulo">Descargar tus datos</h2>
        <ul className="lista-simple">
          {exportaciones.map((e) => (
            <li key={e.href}>
              <span>{e.texto}</span>
              <Enlace href={e.href} className="link-action">
                Ir
              </Enlace>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
