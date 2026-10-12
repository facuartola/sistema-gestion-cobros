"use client";

import { useMemo, useState } from "react";
import { useDataProvider } from "../lib/dataProvider";
import { ETIQUETA_SISTEMA, carpetasPosibles, esDelSistema } from "../lib/gastos";
import { useGastos } from "../lib/GastosContext";
import { LIMITES_GASTO, validarCategoriaEdicion, validarCategoriaNueva } from "../lib/gastosValidacion";
import { nombreMes } from "../lib/resumen";
import { useCandado } from "../lib/useCandado";
import { CarpetaSelect, SeRepite } from "./TipoGastoCampos";
import Ventana from "./Ventana";

const MESES = Array.from({ length: 12 }, (_, i) => {
  const nombre = nombreMes(`2026-${String(i + 1).padStart(2, "0")}`);
  return { valor: i + 1, etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
});

// Agregar o editar un tipo de gasto con las únicas preguntas que hacen falta:
// Nombre, Dentro de (carpeta), ¿Se repite?, Monto habitual (opcional) y el día de
// vencimiento (en los anuales, también el mes). Las mismas reglas que el servidor
// y que la base (lib/gastosValidacion.js) corren acá para avisar antes de enviar.
export default function TipoGastoModal({ categoria = null, parentId = null, onClose, onGuardado }) {
  const provider = useDataProvider();
  const { categorias } = useGastos();
  const { ocupado, ejecutar } = useCandado();
  const editando = categoria !== null;
  const delSistema = esDelSistema(categoria);
  const tieneHijos = editando && categorias.some((c) => c.parent_id === categoria.id);

  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [padre, setPadre] = useState(categoria ? (categoria.parent_id ?? "") : (parentId ?? ""));
  const [repite, setRepite] = useState(categoria?.recurrencia ?? "ninguna");
  const [monto, setMonto] = useState(categoria?.monto_estimado != null ? String(categoria.monto_estimado) : "");
  const [dia, setDia] = useState(categoria?.dia_vencimiento != null ? String(categoria.dia_vencimiento) : "");
  const [mes, setMes] = useState(categoria?.mes_vencimiento != null ? String(categoria.mes_vencimiento) : "");
  const [error, setError] = useState("");

  const carpetas = useMemo(() => carpetasPosibles(categoria, categorias), [categoria, categorias]);

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      nombre,
      recurrencia: repite,
      monto_estimado: monto.trim() === "" ? null : monto,
      dia_vencimiento: dia.trim() === "" ? null : dia,
      mes_vencimiento: mes === "" ? null : mes,
    };
    const destino = padre === "" ? null : padre;
    let invalido = null;
    let datos = null;
    if (delSistema) {
      ({ datos, error: invalido } = validarCategoriaEdicion({ nombre }, categoria, categorias));
    } else if (editando) {
      ({ datos, error: invalido } = validarCategoriaEdicion({ ...cuerpo, parent_id: destino }, categoria, categorias));
    } else {
      ({ datos, error: invalido } = validarCategoriaNueva({ ...cuerpo, parent_id: destino }, categorias));
    }
    if (invalido) return setError(invalido);
    if (editando && !datos) return;

    setError("");
    await ejecutar(async () => {
      try {
        const guardada = editando ? await provider.actualizarCategoriaGasto(categoria.id, datos) : await provider.crearCategoriaGasto({ ...datos, parent_id: destino });
        onGuardado({ categoria: guardada, editando });
      } catch (err) {
        setError(err.message || "Ocurrió un error de conexión.");
      }
    });
  }

  return (
    <Ventana titulo={editando ? "Editar gasto" : "Agregar un gasto"} onClose={onClose} bloqueada={ocupado} formulario={guardar}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {delSistema && (
        <p className="notice-banner" role="note">
          {ETIQUETA_SISTEMA}. Podés cambiarle el nombre; no se puede mover, desactivar ni borrar.
        </p>
      )}

      <label className="field">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={LIMITES_GASTO.nombreCategoria} autoFocus disabled={ocupado} placeholder="Ej: Wifi, Contador, Publicidad" />
      </label>

      {!delSistema && (
        <>
          <CarpetaSelect
            valor={padre}
            onChange={setPadre}
            carpetas={carpetas}
            deshabilitado={ocupado}
            ayuda="Es solo para ordenar. Cómo se calcula todo lo demás depende de si se repite."
          />

          <SeRepite
            valor={repite}
            onChange={setRepite}
            deshabilitado={ocupado || tieneHijos}
            ayuda={tieneHijos ? "Tiene otros gastos adentro: indicá si se repite en cada uno de ellos." : undefined}
          />

          {!tieneHijos && (
          <label className="field">
            <span>Monto habitual (US$), opcional</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 45"
              disabled={ocupado}
            />
            <small>Se completa solo cuando registrás un pago.</small>
          </label>
          )}

          {repite === "anual" && (
            <label className="field">
              <span>Mes en que vence</span>
              <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={ocupado}>
                <option value="">Elegí un mes…</option>
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          )}

          {repite !== "ninguna" && (
            <label className="field">
              <span>Día de vencimiento (1 a 31), opcional</span>
              <input
                type="number"
                min="1"
                max="31"
                inputMode="numeric"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                placeholder="Vacío = a fin de mes"
                disabled={ocupado}
              />
            </label>
          )}
        </>
      )}

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={ocupado}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold" disabled={ocupado}>
          {ocupado ? "Guardando…" : editando ? "Guardar cambios" : "Agregar gasto"}
        </button>
      </div>
    </Ventana>
  );
}
