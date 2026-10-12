"use client";

import { useCallback, useRef, useState } from "react";

// Candado inmediato contra el doble clic: `ocupado` deshabilita el botón recién
// en el próximo dibujo, y tres clics muy seguidos entraban los tres. La
// referencia se marca en el acto: mientras una acción corre, las demás no hacen
// nada. `ejecutar(fn)` devuelve lo que devuelve `fn`, o undefined si estaba
// ocupado.
export function useCandado() {
  const enCurso = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const ejecutar = useCallback(async (accion) => {
    if (enCurso.current) return undefined;
    enCurso.current = true;
    setOcupado(true);
    try {
      return await accion();
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }, []);
  return { ocupado, ejecutar };
}
