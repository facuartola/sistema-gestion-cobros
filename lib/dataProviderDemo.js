import { generarDatosDemo } from "./demoData";
import { gastosPorHacer } from "./gastos";
import { crearGastosDemo } from "./gastosDemo";
import { crearCertificacionDemo } from "./certificacionDemo";
import { hoyArgentinaISO, sumarMesesISO } from "./fechas";
import { generarPanoramaDemo } from "./panoramaDemo";
import { armarSerie, gastosPorPagar, mesesHasta, proximosVencimientos, ultimosMovimientos } from "./resumen";

function idDemo() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Capa de datos "en memoria" para /demo: mismo contrato que dataProviderReal
// (lib/dataProvider.js) — mismos nombres de método, mismas formas de dato,
// misma convención de tirar Error con .message si algo sale mal — pero
// nunca hace un fetch a /api ni a Supabase. Cada instancia arranca de los
// datos generados en ese momento y solo vive en el closure: se pierde al
// recargar la página, que es justo el comportamiento pedido para la demo.
//
// La simplificación asumida: acá no hay "cuotas por mes" reales como en la
// base (una tabla cuotas_jugadores/cuotas_alumnos por mes). Cada persona
// tiene una única cuota_actual en memoria, y cambiar el selector de mes en
// /demo sigue mostrando esa misma cuota — no se simula un historial mes a
// mes completo, que hubiera significado reconstruir gran parte del backend
// solo para la demo.
export function crearProveedorDemo() {
  let { jugadores, alumnos, recordatorios } = generarDatosDemo();
  // Gastos y certificación comparten los pagos: una liquidación crea pagos en
  // Gastos y eliminar uno en Gastos deja pendiente lo que pagaba.
  let certificacionDemo = null;
  const gastosDemo = crearGastosDemo({ alEliminarPago: (id) => certificacionDemo?.alEliminarPago(id) });
  const { instantanea, agregarPagos: _agregarPagos, categoriasDeLiquidacion: _categorias, ...metodosGastos } = gastosDemo;
  certificacionDemo = crearCertificacionDemo({
    gastos: gastosDemo,
    alumnosActivos: () => alumnos.filter((a) => a.activo).map((a) => ({ id: a.id, nombre: a.nombre })),
  });
  const { resumenCertificaciones, alEliminarPago: _alEliminar, ...metodosCertificacion } = certificacionDemo;

  function listaDe(tipo) {
    return tipo === "jugador" ? jugadores : alumnos;
  }
  function setListaDe(tipo, nueva) {
    if (tipo === "jugador") jugadores = nueva;
    else alumnos = nueva;
  }

  return {
    ...metodosGastos,
    ...metodosCertificacion,

    // La copia de la demo se arma acá, con los datos de ejemplo en memoria y
    // sin ningún pedido a la API. Lo que la demo no maneja (cuotas por mes,
    // clases, inscripciones y sesiones) sale vacío.
    async descargarCopia(separador = ",") {
      const { armarCopia, TABLAS } = await import("./copia");
      const tablas = Object.fromEntries(TABLAS.map((t) => [t.nombre, []]));
      tablas.jugadores = jugadores.map((p) => ({ ...p }));
      tablas.alumnos = alumnos.map((p) => ({ ...p }));
      tablas.recordatorios = recordatorios.map((r) => ({ ...r }));
      tablas.categorias_gasto = (await metodosGastos.listarCategoriasGasto()).categorias;
      tablas.pagos_gasto = (await metodosGastos.listarPagosGasto()).pagos;
      tablas.certificaciones = await metodosCertificacion.listarCertificaciones();
      tablas.equipo = await metodosCertificacion.listarEquipo();
      const { zip, nombre, cercaDelLimite } = armarCopia(tablas, { separador });
      return { blob: new Blob([zip], { type: "application/zip" }), nombre, cercaDelLimite };
    },

    async listarPersonas(tipo, params = {}) {
      const incluirInactivos = String(params.incluir_inactivos ?? "") === "1";
      return listaDe(tipo)
        .filter((p) => incluirInactivos || p.activo)
        .map((p) => ({ ...p }));
    },

    async crearPersona(tipo, body) {
      const monto = Number(body.monto_mensual);
      const nueva = {
        id: idDemo(),
        tipo,
        nombre: body.nombre,
        monto_mensual: monto,
        ...(tipo === "alumno" ? { monto_total: body.monto_total ?? null, total_abonado: 0 } : {}),
        dia_vencimiento: body.dia_vencimiento ?? null,
        contacto: body.contacto ?? null,
        notas: body.notas ?? null,
        activo: true,
        meses_adeudados: 0,
        total_anio: 0,
        cuota_actual: { estado: "pendiente", monto, fecha_pago: null },
      };
      setListaDe(tipo, [...listaDe(tipo), nueva]);
      return { ...nueva };
    },

    async actualizarPersona(tipo, id, body) {
      let actualizada = null;
      setListaDe(
        tipo,
        listaDe(tipo).map((p) => {
          if (p.id !== id) return p;
          actualizada = { ...p, ...body };
          return actualizada;
        })
      );
      if (!actualizada) throw new Error("No se encontró la persona.");
      return { ...actualizada };
    },

    async guardarCuota(tipo, id, body) {
      let actualizada = null;
      setListaDe(
        tipo,
        listaDe(tipo).map((p) => {
          if (p.id !== id) return p;
          const cuota_actual = {
            estado: body.estado,
            monto: Number(body.monto),
            fecha_pago: body.estado === "pagado" ? body.fecha_pago || hoyArgentinaISO() : null,
            metodo_pago: body.estado === "pagado" ? (body.metodo_pago ?? p.cuota_actual?.metodo_pago ?? null) : null,
          };
          actualizada = { ...p, cuota_actual };
          return actualizada;
        })
      );
      if (!actualizada) throw new Error("No se encontró la persona.");
      return { ...actualizada };
    },

    // Demo: una sola cuota por persona (ver la nota de arriba).
    async listarCuotas(tipo, id) {
      const p = listaDe(tipo).find((x) => x.id === id);
      if (!p?.cuota_actual) return [];
      return [{ mes: `${hoyArgentinaISO().slice(0, 7)}-01`, ...p.cuota_actual }];
    },

    // Datos del panel de Inicio: 12 meses de historia coherente (lib/panoramaDemo.js).
    async obtenerPanorama() {
      const { categorias, pagos } = instantanea();
      return generarPanoramaDemo({ personas: [...jugadores, ...alumnos].filter((p) => p.activo), categorias, pagos, hoy: hoyArgentinaISO() });
    },

    // Resumen de Inicio con datos de ejemplo: el mes actual sale de las cuotas y
    // los pagos en memoria; los cobros de meses anteriores y los gastos de más de
    // un mes atrás son un historial inventado y estable.
    async obtenerResumen(mes) {
      const hoy = hoyArgentinaISO();
      const { categorias, pagos } = instantanea();
      const gastadoReal = (m) => pagos.filter((p) => p.fecha_pago.slice(0, 7) === m).reduce((acc, p) => acc + p.monto, 0);
      const mesAnterior = sumarMesesISO(hoy.slice(0, 7), -1);
      const cobradoActual = [...jugadores, ...alumnos].reduce(
        (acc, p) => acc + (p.cuota_actual?.estado === "pagado" ? Number(p.cuota_actual.monto) : 0),
        0
      );
      const HISTORIAL = [0.78, 0.84, 1.1, 0.9, 0.97];
      const meses = mesesHasta(mes, 6);
      const filas = meses.map((m, i) => ({
        mes: m,
        cobrado: m === hoy.slice(0, 7) ? cobradoActual : Math.round(cobradoActual * 1.5 * HISTORIAL[i % HISTORIAL.length]),
        gastado: m >= mesAnterior ? gastadoReal(m) : 380 + (i % 3) * 90,
      }));
      const personas = [...jugadores, ...alumnos].filter((p) => p.activo);
      const pagadas = new Set(
        personas.filter((p) => p.cuota_actual?.estado === "pagado").map((p) => `${p.tipo}-${p.id}-${hoy.slice(0, 7)}`)
      );
      const cobrosPagados = personas
        .filter((p) => p.cuota_actual?.estado === "pagado" && p.cuota_actual.fecha_pago)
        .map((p) => ({
          id: p.id,
          fecha_pago: p.cuota_actual.fecha_pago,
          monto: p.cuota_actual.monto,
          metodo_pago: p.cuota_actual.metodo_pago ?? null,
          nombre: p.nombre,
        }));
      const porId = new Map(categorias.map((c) => [c.id, c]));
      const pagosRecientes = pagos.map((p) => ({ ...p, nombre: porId.get(p.categoria_id)?.nombre ?? "Gasto" }));
      return {
        mes,
        serie: armarSerie(meses, filas),
        cobradoAnio: { anio: mes.slice(0, 4), total: Math.round(cobradoActual * 7.5) },
        gastosPorPagar: gastosPorPagar({ categorias, pagos, hoy }),
        gastos: gastosPorHacer({ categorias, pagos, hoy }),
        proximos: proximosVencimientos({ personas, pagadas, categorias, pagos, hoy }),
        movimientos: ultimosMovimientos(cobrosPagados, pagosRecientes),
        certificaciones: resumenCertificaciones(),
      };
    },

    async listarRecordatorios(params = {}) {
      let lista = recordatorios;
      if (params.hecho !== undefined) {
        const hechoBuscado = String(params.hecho) === "1";
        lista = lista.filter((r) => r.hecho === hechoBuscado);
      }
      return lista.map((r) => ({ ...r }));
    },

    async crearRecordatorio(body) {
      const nuevo = { id: idDemo(), hecho: false, hecho_en: null, ...body };
      recordatorios = [...recordatorios, nuevo];
      return { ...nuevo };
    },

    async actualizarRecordatorio(id, body) {
      let actualizado = null;
      recordatorios = recordatorios.map((r) => {
        if (r.id !== id) return r;
        actualizado = { ...r, ...body };
        if (body.hecho !== undefined) {
          actualizado.hecho_en = body.hecho ? new Date().toISOString() : null;
        }
        return actualizado;
      });
      if (!actualizado) throw new Error("No se encontró el recordatorio.");
      return { ...actualizado };
    },

    async eliminarRecordatorio(id) {
      const habia = recordatorios.some((r) => r.id === id);
      recordatorios = recordatorios.filter((r) => r.id !== id);
      if (!habia) throw new Error("No se encontró el recordatorio.");
      return { ok: true };
    },
  };
}
