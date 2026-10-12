// Validación de categorías, pagos y comprobantes de gastos. Es la misma para el
// servidor (que no puede confiar en el navegador) y para los formularios.
// Todas devuelven { datos } listo para guardar o { error } en castellano.
import { ES_RECURRENTE, MAX_NIVELES, alturaDelSubarbol, esDelSistema, estaEnLaRama, indexar, nivelDe, periodoDe } from "./gastos";
import { errorFechaDePago, esFechaISO, esUuid, METODOS_PAGO } from "./validacion";

export const LIMITES_GASTO = {
  nombreCategoria: 80,
  descripcion: 300,
  proveedor: 120,
  // La columna es numeric(10,2) con check monto < 1.000.000.
  montoMaximo: 999_999.99,
};

export const COMPROBANTE = {
  maxBytes: 5 * 1024 * 1024,
  tipos: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" },
};

function textoOpcional(valor, limite, nombre) {
  if (valor === undefined) return { ausente: true };
  if (valor === null) return { valor: null };
  if (typeof valor !== "string") return { error: `${nombre} no es válido.` };
  const limpio = valor.trim();
  if (limpio.length > limite) return { error: `${nombre} no puede pasar de ${limite} caracteres.` };
  return { valor: limpio === "" ? null : limpio };
}

// Monto positivo con a lo sumo 2 decimales.
export function parseMonto(valor, { opcional = false } = {}) {
  if (opcional && (valor === null || valor === undefined || valor === "")) return { valor: null };
  if (valor === null || valor === undefined || valor === "" || typeof valor === "boolean") {
    return { error: "El monto tiene que ser un número mayor a 0." };
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return { error: "El monto tiene que ser un número mayor a 0." };
  if (n > LIMITES_GASTO.montoMaximo) return { error: "El monto es demasiado alto. Revisá que no sobre ningún cero." };
  return { valor: Math.round(n * 100) / 100 };
}

// --- Categorías ------------------------------------------------------------------

// Campos de recurrencia coherentes entre sí. `actual` es la categoría existente
// (al editar) para completar lo que no vino en el pedido.
function parseRecurrencia(body, actual = {}) {
  const recurrencia = body.recurrencia !== undefined ? body.recurrencia : (actual.recurrencia ?? "ninguna");
  if (!["ninguna", "mensual", "anual"].includes(recurrencia)) return { error: "Elegí cada cuánto se paga: nunca, todos los meses o una vez al año." };

  const montoCrudo = body.monto_estimado !== undefined ? body.monto_estimado : actual.monto_estimado;
  let monto_estimado = null;
  if (montoCrudo !== null && montoCrudo !== undefined && montoCrudo !== "") {
    const { valor, error } = parseMonto(montoCrudo);
    if (error) return { error: "El monto estimado tiene que ser un número mayor a 0, o dejarlo vacío." };
    monto_estimado = valor;
  }

  if (recurrencia === "ninguna") return { campos: { recurrencia, monto_estimado, dia_vencimiento: null, mes_vencimiento: null } };

  const diaCrudo = body.dia_vencimiento !== undefined ? body.dia_vencimiento : actual.dia_vencimiento;
  let dia_vencimiento = null;
  if (diaCrudo !== null && diaCrudo !== undefined && diaCrudo !== "") {
    const d = Number(diaCrudo);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { error: "El día de vencimiento tiene que ser un número entero entre 1 y 31." };
    dia_vencimiento = d;
  }

  let mes_vencimiento = null;
  if (recurrencia === "anual") {
    const mesCrudo = body.mes_vencimiento !== undefined ? body.mes_vencimiento : actual.mes_vencimiento;
    const m = Number(mesCrudo);
    if (mesCrudo === null || mesCrudo === undefined || mesCrudo === "" || !Number.isInteger(m) || m < 1 || m > 12) {
      return { error: "Un gasto anual necesita el mes en que vence (de 1 a 12)." };
    }
    mes_vencimiento = m;
  }
  return { campos: { recurrencia, monto_estimado, dia_vencimiento, mes_vencimiento } };
}

function parseNombreCategoria(valor) {
  if (typeof valor !== "string" || valor.trim() === "") return { error: "Ingresá el nombre del tipo de gasto." };
  const nombre = valor.trim().replace(/\s+/g, " ");
  if (nombre.length > LIMITES_GASTO.nombreCategoria) {
    return { error: `El nombre no puede pasar de ${LIMITES_GASTO.nombreCategoria} caracteres.` };
  }
  return { nombre };
}

// Alta de una categoría. `categorias` son todas las existentes (para validar el
// padre y la profundidad).
export function validarCategoriaNueva(body, categorias) {
  const { nombre, error: errorNombre } = parseNombreCategoria(body.nombre);
  if (errorNombre) return { error: errorNombre };

  const porId = indexar(categorias);
  let parent_id = null;
  if (body.parent_id !== undefined && body.parent_id !== null && body.parent_id !== "") {
    if (!esUuid(body.parent_id) || !porId.has(body.parent_id)) return { error: "El tipo de gasto principal no existe." };
    const padre = porId.get(body.parent_id);
    if (!padre.activo) return { error: `“${padre.nombre}” está desactivada: activala antes de agregarle subtipos.` };
    if (padre.recurrencia !== "ninguna") {
      return { error: `“${padre.nombre}” es un gasto ${padre.recurrencia}: no puede tener subtipos. Los pagos se registran directamente en ella.` };
    }
    if (nivelDe(padre.id, porId) + 1 > MAX_NIVELES) {
      return { error: `Los tipos de gasto pueden tener hasta ${MAX_NIVELES} niveles. “${padre.nombre}” ya está en el último.` };
    }
    parent_id = padre.id;
  }

  const repetido = nombreRepetido(nombre, parent_id, categorias, null);
  if (repetido) return { error: repetido };

  const { campos, error } = parseRecurrencia(body);
  if (error) return { error };
  return { datos: { nombre, parent_id, ...campos } };
}

// Dos tipos de gasto no se llaman igual dentro de la misma carpeta.
function nombreRepetido(nombre, parentId, categorias, idPropio) {
  const mismo = categorias.some(
    (c) => c.id !== idPropio && (c.parent_id ?? null) === (parentId ?? null) && c.nombre.trim().toLowerCase() === nombre.toLowerCase()
  );
  return mismo ? "Ya hay un tipo de gasto con ese nombre en ese lugar." : null;
}

// ¿Se puede dejar `categoria` dentro de la carpeta `nuevoPadreId` (null = al principio)?
// Devuelve { ok: true } o { error } con la explicación. Las mismas reglas que la base
// (trigger proteger_categorias) y que la API, para avisar antes de enviar.
function validarMovimiento(categoria, nuevoPadreId, categorias) {
  if (esDelSistema(categoria)) {
    return { error: `“${categoria.nombre}” es automático: lo genera Pagar al equipo. Se puede renombrar, pero no moverlo.` };
  }
  const porId = indexar(categorias);
  if (nuevoPadreId !== null) {
    if (!esUuid(nuevoPadreId) || !porId.has(nuevoPadreId)) return { error: "La carpeta elegida no existe." };
    const padre = porId.get(nuevoPadreId);
    if (estaEnLaRama(padre.id, categoria.id, categorias)) {
      return { error: "Un tipo de gasto no puede quedar dentro de sí mismo ni de lo que tiene adentro." };
    }
    if (!padre.activo) return { error: `“${padre.nombre}” está desactivado: activalo antes de poner algo adentro.` };
    if (esDelSistema(padre)) return { error: `“${padre.nombre}” es automático: lo genera Pagar al equipo y no puede tener nada adentro.` };
    if (padre.recurrencia !== "ninguna") {
      return { error: `“${padre.nombre}” se repite (${padre.recurrencia === "mensual" ? "cada mes" : "una vez al año"}): no puede tener otros tipos adentro. Elegí otra carpeta.` };
    }
    const nivel = nivelDe(padre.id, porId) + alturaDelSubarbol(categoria.id, categorias);
    if (nivel > MAX_NIVELES) {
      return { error: `Los tipos de gasto admiten hasta ${MAX_NIVELES} niveles: ahí quedaría en el nivel ${nivel}. Elegí otra carpeta.` };
    }
  }
  const repetido = nombreRepetido(categoria.nombre, nuevoPadreId, categorias, categoria.id);
  if (repetido) return { error: repetido };
  return { ok: true };
}

// Edición: nombre, recurrencia y sus campos, orden y activo. No se mueve de
// padre. Las categorías con `clave` (las de la liquidación de coaches) se
// pueden renombrar pero no desactivar.
export function validarCategoriaEdicion(body, categoria, categorias) {
  const cambios = {};
  if (body.nombre !== undefined) {
    const { nombre, error } = parseNombreCategoria(body.nombre);
    if (error) return { error };
    const destino = body.parent_id !== undefined ? (body.parent_id ?? null) : (categoria.parent_id ?? null);
    const repetido = nombreRepetido(nombre, destino, categorias, categoria.id);
    if (repetido) return { error: repetido };
    cambios.nombre = nombre;
  }

  const tocaRecurrencia = ["recurrencia", "monto_estimado", "dia_vencimiento", "mes_vencimiento"].some((k) => body[k] !== undefined);
  if (tocaRecurrencia) {
    const { campos, error } = parseRecurrencia(body, categoria);
    if (error) return { error };
    if (campos.recurrencia !== "ninguna" && categorias.some((c) => c.parent_id === categoria.id)) {
      return { error: `“${categoria.nombre}” tiene subtipos, así que no puede ser un gasto mensual ni anual: configuralo en cada subtipo.` };
    }
    Object.assign(cambios, campos);
  }

  if (body.orden !== undefined) {
    if (!Number.isInteger(body.orden) || body.orden < 0 || body.orden > 10_000) return { error: "El orden no es válido." };
    cambios.orden = body.orden;
  }

  if (body.activo !== undefined) {
    if (typeof body.activo !== "boolean") return { error: "El estado del tipo de gasto no es válido." };
    if (body.activo === false && categoria.clave) {
      return { error: `“${categoria.nombre}” es automático: lo genera Pagar al equipo. Se puede renombrar, pero no desactivarlo.` };
    }
    if (body.activo === true && categoria.parent_id) {
      const padre = categorias.find((c) => c.id === categoria.parent_id);
      if (padre && !padre.activo) return { error: `Activá primero “${padre.nombre}”, que es el tipo de gasto principal.` };
    }
    cambios.activo = body.activo;
  }

  if (body.parent_id !== undefined && (body.parent_id ?? null) !== (categoria.parent_id ?? null)) {
    const { error } = validarMovimiento(categoria, body.parent_id ?? null, categorias);
    if (error) return { error };
    cambios.parent_id = body.parent_id ?? null;
  }
  if (Object.keys(cambios).length === 0) return { error: "No hay nada para actualizar." };
  return { datos: cambios };
}

// ¿Se puede borrar? { ok: true } o { error } con la explicación. `cantidadPagos`
// son los pagos de la categoría misma.
export function puedeBorrarCategoria(categoria, categorias, cantidadPagos) {
  if (categoria.clave) {
    return { error: `“${categoria.nombre}” es automático: lo genera Pagar al equipo. Se puede renombrar, pero no borrarlo.` };
  }
  if (categorias.some((c) => c.parent_id === categoria.id)) {
    return { error: `“${categoria.nombre}” tiene otros tipos adentro. Borrá o desactivá primero los de adentro.` };
  }
  if (cantidadPagos > 0) {
    return {
      error: `“${categoria.nombre}” tiene ${cantidadPagos} ${cantidadPagos === 1 ? "pago registrado" : "pagos registrados"}, así que no se puede borrar. Si ya no lo usás, desactivala: deja de aparecer en el menú pero el historial se conserva.`,
    };
  }
  return { ok: true };
}

// --- Pagos -----------------------------------------------------------------------

// Alta o edición completa de un pago. `categoria` es la fila de la categoría
// elegida (el servidor ya la buscó); `hoy` en hora Argentina.
export function validarPago(body, categoria, hoy) {
  if (!categoria) return { error: "Elegí el tipo de gasto." };
  if (!categoria.activo) return { error: `“${categoria.nombre}” está desactivada: activala para registrar pagos.` };

  const { valor: monto, error: errorMonto } = parseMonto(body.monto);
  if (errorMonto) return { error: errorMonto };

  const fecha_pago = body.fecha_pago === undefined || body.fecha_pago === null || body.fecha_pago === "" ? hoy : body.fecha_pago;
  if (!esFechaISO(fecha_pago)) return { error: "La fecha del pago no es válida." };
  const errorFecha = errorFechaDePago(fecha_pago, hoy, "La fecha del pago");
  if (errorFecha) return { error: errorFecha };

  if (!METODOS_PAGO.includes(body.metodo_pago)) return { error: "Elegí cómo se pagó: efectivo o transferencia." };

  const proveedor = textoOpcional(body.proveedor, LIMITES_GASTO.proveedor, "El proveedor");
  if (proveedor.error) return { error: proveedor.error };
  const descripcion = textoOpcional(body.descripcion, LIMITES_GASTO.descripcion, "La descripción");
  if (descripcion.error) return { error: descripcion.error };

  // Período: solo las recurrentes. Viene como "YYYY-MM" o "YYYY-MM-01"; si no
  // viene, el de la fecha del pago.
  let periodo = null;
  if (ES_RECURRENTE(categoria)) {
    if (body.periodo === undefined || body.periodo === null || body.periodo === "") {
      periodo = periodoDe(categoria, fecha_pago);
    } else {
      const crudo = String(body.periodo);
      const normalizado = crudo.length === 7 ? `${crudo}-01` : crudo;
      if (!esFechaISO(normalizado) || normalizado.slice(8) !== "01") return { error: "El mes del pago no es válido." };
      periodo = categoria.recurrencia === "anual" ? `${normalizado.slice(0, 4)}-01-01` : normalizado;
    }
  }

  return {
    datos: {
      categoria_id: categoria.id,
      fecha_pago,
      periodo,
      monto,
      metodo_pago: body.metodo_pago,
      proveedor: proveedor.valor ?? null,
      descripcion: descripcion.valor ?? null,
    },
  };
}

// --- Pagos de una liquidación al equipo ----------------------------------------------

const MENSAJE_PAGO_LIQUIDACION =
  "En un pago al equipo solo se pueden cambiar la fecha, el método, el proveedor, la descripción y el comprobante. El monto, el tipo de gasto y la persona los define el pago al equipo: si están mal, eliminá el pago (lo que pagaba vuelve a quedar pendiente) y volvé a pagar al equipo.";

const distinto = (a, b) => (a ?? null) !== (b ?? null);

// Edición de un pago con equipo_id o modulo_id: solo fecha, método, proveedor y
// descripción (el comprobante va por su propia ruta). Si el pedido trae otro
// campo con un valor distinto del actual, se rechaza.
export function validarEdicionPagoLiquidacion(body, actual, hoy = null) {
  const intocables = [
    ["monto", (v) => v !== undefined && Number(v) !== Number(actual.monto)],
    ["categoria_id", (v) => v !== undefined && distinto(v, actual.categoria_id)],
    ["equipo_id", (v) => v !== undefined && distinto(v, actual.equipo_id)],
    ["modulo_id", (v) => v !== undefined && distinto(v, actual.modulo_id)],
    ["periodo", (v) => v !== undefined && distinto(v || null, actual.periodo)],
  ];
  if (intocables.some(([campo, cambia]) => cambia(body[campo]))) return { error: MENSAJE_PAGO_LIQUIDACION };

  const datos = {};
  if (body.fecha_pago !== undefined) {
    if (!esFechaISO(body.fecha_pago)) return { error: "La fecha del pago no es válida." };
    const errorFecha = hoy ? errorFechaDePago(body.fecha_pago, hoy, "La fecha del pago") : null;
    if (errorFecha) return { error: errorFecha };
    datos.fecha_pago = body.fecha_pago;
  }
  if (body.metodo_pago !== undefined) {
    if (!METODOS_PAGO.includes(body.metodo_pago)) return { error: "Elegí cómo se pagó: efectivo o transferencia." };
    datos.metodo_pago = body.metodo_pago;
  }
  const proveedor = textoOpcional(body.proveedor, LIMITES_GASTO.proveedor, "El proveedor");
  if (proveedor.error) return { error: proveedor.error };
  if (!proveedor.ausente) datos.proveedor = proveedor.valor;
  const descripcion = textoOpcional(body.descripcion, LIMITES_GASTO.descripcion, "La descripción");
  if (descripcion.error) return { error: descripcion.error };
  if (!descripcion.ausente) datos.descripcion = descripcion.valor;

  if (Object.keys(datos).length === 0) return { error: "No hay nada para actualizar." };
  return { datos };
}

// --- Comprobantes ------------------------------------------------------------------

// Validación del archivo antes de subirlo: { extension } o { error }. `archivo`
// es cualquier cosa con `type` y `size` (File en el navegador, Blob en el servidor).
export function validarComprobante(archivo) {
  if (!archivo || typeof archivo.size !== "number") return { error: "Elegí un archivo." };
  const extension = COMPROBANTE.tipos[archivo.type];
  if (!extension) return { error: "El comprobante tiene que ser una foto (JPG, PNG o WebP) o un PDF." };
  if (archivo.size === 0) return { error: "El archivo está vacío." };
  if (archivo.size > COMPROBANTE.maxBytes) {
    const mb = (archivo.size / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 });
    return { error: `El archivo pesa ${mb} MB y el máximo es 5 MB. Probá con una foto más liviana o comprimí el PDF.` };
  }
  return { extension };
}

// El tipo declarado se puede falsear; esto mira los primeros bytes. Devuelve el
// mime real ("image/jpeg", ...) o null si no es ninguno de los cuatro.
export function tipoPorContenido(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  return null;
}

// Ruta de un comprobante dentro del bucket: <id del pago>/<marca de tiempo>.<ext>.
export function rutaComprobante(pagoId, extension, ahoraMs = Date.now()) {
  return `${pagoId}/${ahoraMs}.${extension}`;
}

// Una ruta guardada solo es válida si pertenece a ese pago y tiene esta forma.
export function esRutaDeComprobante(ruta, pagoId) {
  return typeof ruta === "string" && ruta.startsWith(`${pagoId}/`) && /^[0-9a-f-]{36}\/\d+\.(jpg|png|webp|pdf)$/i.test(ruta);
}
