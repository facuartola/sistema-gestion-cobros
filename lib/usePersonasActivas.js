"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDataProvider } from "./dataProvider";
import { mesArgentinaISO } from "./fechas";

// Jugadores y alumnos activos, tal como los necesitan Recordatorios (para
// las sugerencias, el buscador de persona y mostrar a quién está asociado
// cada recordatorio) — compartido entre la vista completa y el panel lateral.
export function usePersonasActivas() {
  const provider = useDataProvider();
  const [jugadores, setJugadores] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const mes = mesArgentinaISO();
      const [dJug, dAlu] = await Promise.all([
        provider.listarPersonas("jugador", { incluir_inactivos: 1, mes }),
        provider.listarPersonas("alumno", { incluir_inactivos: 1, mes }),
      ]);
      setJugadores(dJug);
      setAlumnos(dAlu);
    } catch {
      // No crítico para el panel/formulario: si falla, quedan listas vacías.
      setJugadores([]);
      setAlumnos([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const personasActivas = useMemo(
    () => [
      ...jugadores.filter((j) => j.activo).map((j) => ({ ...j, tipo: "jugador" })),
      ...alumnos.filter((a) => a.activo).map((a) => ({ ...a, tipo: "alumno" })),
    ],
    [jugadores, alumnos]
  );

  const buscarPersona = useCallback(
    (r) => {
      if (r.jugador_id) {
        const j = jugadores.find((x) => x.id === r.jugador_id);
        return j ? { tipo: "jugador", nombre: j.nombre } : null;
      }
      if (r.alumno_id) {
        const a = alumnos.find((x) => x.id === r.alumno_id);
        return a ? { tipo: "alumno", nombre: a.nombre } : null;
      }
      return null;
    },
    [jugadores, alumnos]
  );

  return { jugadores, alumnos, personasActivas, buscarPersona, loading, cargar };
}
