"use client";

import { useMemo, useState } from "react";
import { useAcciones } from "../lib/AccionesContext";
import { useDataProvider } from "../lib/dataProvider";
import { ETIQUETA_SISTEMA, MAX_NIVELES, armarArbol, esDelSistema, hijosPorPadre, idsDelGrupo, indexar, nivelDe } from "../lib/gastos";
import { useGastos } from "../lib/GastosContext";
import { formatoDolares } from "../lib/moneda";
import { nombreMes } from "../lib/resumen";
import { useCandado } from "../lib/useCandado";
import Enlace from "./Enlace";
import { EsqueletoLista } from "./Esqueleto";
import { IconoLapiz } from "./Iconos";
import TipoGastoModal from "./TipoGastoModal";

// "Cada mes · día 10 · US$ 45", "No se repite · US$ 45".
function resumenDelTipo(c) {
  const monto = c.monto_estimado != null ? formatoDolares(c.monto_estimado) : null;
  if (c.recurrencia === "ninguna") return ["No se repite", monto].filter(Boolean).join(" · ");
  const partes = [c.recurrencia === "mensual" ? "Cada mes" : `Una vez al año, en ${nombreMes(`2026-${String(c.mes_vencimiento).padStart(2, "0")}`)}`];
  partes.push(c.dia_vencimiento ? `día ${c.dia_vencimiento}` : "a fin de mes");
  if (monto) partes.push(monto);
  return partes.join(" · ");
}

function aplanar(nodos, salida = []) {
  for (const n of nodos) {
    salida.push(n);
    aplanar(n.hijos, salida);
  }
  return salida;
}

// Mis gastos: todo lo que le genera gastos al negocio, armado a mano. Un árbol en
// castellano simple: agregar, renombrar, mover a otra carpeta, subir y bajar,
// desactivar y reactivar. "¿Se repite?" decide cómo se calcula todo; la carpeta
// solo ordena. Un gasto desactivado deja de verse en tarjetas, selectores y avisos,
// pero su historial se conserva y sigue contando en los totales y en los CSV.
export default function MisGastos() {
  const provider = useDataProvider();
  const { refrescar, avisar } = useAcciones();
  const { categorias, cargando, error: errorCarga, recargar } = useGastos();
  const { ejecutar } = useCandado();
  const [modal, setModal] = useState(null); // { categoria?, parentId? }
  const [ocupada, setOcupada] = useState(null);
  const [error, setError] = useState("");
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  const arbol = useMemo(() => armarArbol(categorias, { soloActivas: !mostrarDesactivados }), [categorias, mostrarDesactivados]);
  const filas = useMemo(() => aplanar(arbol), [arbol]);
  const hermanas = useMemo(() => hijosPorPadre(categorias), [categorias]);
  const cantidadDesactivados = categorias.filter((c) => !c.activo).length;

  // Una acción a la vez, con candado contra el doble clic.
  function correr(id, accion, exito, deshacer) {
    return ejecutar(async () => {
      setOcupada(id);
      setError("");
      try {
        await accion();
        refrescar();
        if (exito) avisar(exito, deshacer);
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      } finally {
        setOcupada(null);
      }
    });
  }

  // Desactivar un gasto desactiva también lo que tiene adentro; al volver a activarlo
  // vuelve lo que tenía adentro (de arriba hacia abajo, porque un gasto no se activa
  // si la carpeta de arriba sigue desactivada).
  function alternarActivo(c) {
    const activar = !c.activo;
    const adentro = activar ? idsDelGrupo(c.id, categorias).filter((id) => id !== c.id && !categorias.find((x) => x.id === id).activo) : [];
    const porNivel = [...adentro].sort((a, b) => nivelDe(a, indexar(categorias)) - nivelDe(b, indexar(categorias)));
    correr(
      c.id,
      async () => {
        await provider.actualizarCategoriaGasto(c.id, { activo: activar });
        for (const id of porNivel) await provider.actualizarCategoriaGasto(id, { activo: true });
      },
      activar
        ? `Se volvió a activar “${c.nombre}”${porNivel.length ? " y lo que tiene adentro" : ""}.`
        : `Se desactivó “${c.nombre}”. Su historial se conserva.`,
      activar ? undefined : () => provider.actualizarCategoriaGasto(c.id, { activo: true }).then(refrescar, () => {})
    );
  }

  function borrar(c) {
    setConfirmando(null);
    correr(c.id, () => provider.eliminarCategoriaGasto(c.id), `Se borró “${c.nombre}”.`);
  }

  // Intercambia el lugar con el hermano de arriba o de abajo (entre los que se
  // ven) y renumera todos: así también funciona si había órdenes repetidos.
  function mover(c, delta) {
    const todos = [...(hermanas.get(c.parent_id ?? null) || [])];
    const visibles = todos.filter((x) => mostrarDesactivados || x.activo);
    const vecino = visibles[visibles.findIndex((x) => x.id === c.id) + delta];
    if (!vecino) return;
    const i = todos.findIndex((x) => x.id === c.id);
    const j = todos.findIndex((x) => x.id === vecino.id);
    [todos[i], todos[j]] = [todos[j], todos[i]];
    const cambios = todos.map((x, k) => ({ x, orden: k + 1 })).filter(({ x, orden }) => x.orden !== orden);
    correr(c.id, () => Promise.all(cambios.map(({ x, orden }) => provider.actualizarCategoriaGasto(x.id, { orden }))));
  }

  function alGuardar({ categoria, editando }) {
    setModal(null);
    refrescar();
    avisar(`${editando ? "Se guardaron los cambios de" : "Se agregó"} “${categoria.nombre}”.`);
  }

  return (
    <>
      <div className="page-header">
        <p>
          Armá acá todo lo que te genera gastos (Wifi, teléfono, publicidad…). Las carpetas solo sirven para ordenar: lo que decide cuándo
          vence cada gasto es si se repite.
        </p>
        <div className="acciones">
          <button type="button" className="btn-gold" onClick={() => setModal({ parentId: null })}>
            Agregar un gasto
          </button>
        </div>
      </div>

      {(error || errorCarga) && (
        <div className="error-banner" role="alert">
          {error || errorCarga}{" "}
          {errorCarga && !error && (
            <button type="button" className="link-action" onClick={recargar}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {cantidadDesactivados > 0 && (
        <div className="mis-gastos-barra">
          <button type="button" className="btn-ghost btn-sm" aria-pressed={mostrarDesactivados} onClick={() => setMostrarDesactivados((v) => !v)}>
            {mostrarDesactivados ? "Ocultar desactivados" : `Mostrar desactivados (${cantidadDesactivados})`}
          </button>
        </div>
      )}

      {cargando ? (
        <div className="card panel">
          <EsqueletoLista items={5} />
        </div>
      ) : filas.length === 0 ? (
        <div className="card estado-vacio">
          <h3>Todavía no cargaste ningún gasto</h3>
          <p>Agregá el primero, por ejemplo “Wifi” que se repite cada mes. Después podés ordenarlos en carpetas.</p>
          <div className="estado-vacio-acciones">
            <button type="button" className="btn-gold" onClick={() => setModal({ parentId: null })}>
              Agregar un gasto
            </button>
          </div>
        </div>
      ) : (
        <div className="card categorias-admin">
          <ul className="lista-categorias">
            {filas.map((c) => {
              const visibles = (hermanas.get(c.parent_id ?? null) || []).filter((x) => mostrarDesactivados || x.activo);
              const posicion = visibles.findIndex((x) => x.id === c.id);
              const ocupadaAhora = ocupada === c.id;
              const sistema = esDelSistema(c);
              const puedeAdentro = c.nivel < MAX_NIVELES && c.recurrencia === "ninguna" && c.activo && !sistema;
              return (
                <li key={c.id} className={`fila-categoria${c.activo ? "" : " inactiva"}`} style={{ "--nivel": c.nivel - 1 }}>
                  <div className="cat-nombre">
                    <Enlace href={`/gastos/${c.id}`} className="cat-titulo">
                      {c.nombre}
                    </Enlace>
                    <span className="lbl">
                      {c.hijos.length > 0
                        ? `Carpeta · ${c.hijos.length} ${c.hijos.length === 1 ? "gasto adentro" : "gastos adentro"}`
                        : sistema
                          ? "No se repite"
                          : resumenDelTipo(c)}
                    </span>
                    {sistema && <span className="lbl cat-nota">Se puede renombrar; no se puede mover, desactivar ni borrar.</span>}
                  </div>
                  <div className="cat-etiquetas">
                    {!c.activo && <span className="pill">Desactivado</span>}
                    {sistema && <span className="pill">{ETIQUETA_SISTEMA}</span>}
                  </div>
                  <div className="row-actions cat-acciones">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => mover(c, -1)}
                      disabled={ocupadaAhora || posicion <= 0}
                      aria-label={`Subir ${c.nombre}`}
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => mover(c, 1)}
                      disabled={ocupadaAhora || posicion >= visibles.length - 1}
                      aria-label={`Bajar ${c.nombre}`}
                      title="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setModal({ categoria: c })}
                      disabled={ocupadaAhora}
                      aria-label={`Editar ${c.nombre}`}
                      title="Editar, cambiar de carpeta"
                    >
                      <IconoLapiz size={13} />
                    </button>
                    {puedeAdentro && (
                      <button type="button" className="link-action" onClick={() => setModal({ parentId: c.id })} disabled={ocupadaAhora}>
                        Agregar adentro
                      </button>
                    )}
                    {!sistema && (
                      <button type="button" className="link-action" onClick={() => alternarActivo(c)} disabled={ocupadaAhora}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                    {!sistema &&
                      (confirmando === c.id ? (
                        <span className="confirmar-borrado" role="group" aria-label={`¿Borrar ${c.nombre}?`}>
                          <span className="lbl">¿Borrar?</span>
                          <button type="button" className="link-action danger" onClick={() => borrar(c)} disabled={ocupadaAhora}>
                            Sí, borrar
                          </button>
                          <button type="button" className="link-action" onClick={() => setConfirmando(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="link-action danger" onClick={() => setConfirmando(c.id)} disabled={ocupadaAhora}>
                          Borrar
                        </button>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="lbl mis-gastos-pie">
        Solo se puede borrar un gasto que no tiene pagos. Si ya no lo usás, desactivalo: deja de aparecer pero el historial se conserva.
      </p>

      {modal && (
        <TipoGastoModal categoria={modal.categoria ?? null} parentId={modal.parentId ?? null} onClose={() => setModal(null)} onGuardado={alGuardar} />
      )}
    </>
  );
}
