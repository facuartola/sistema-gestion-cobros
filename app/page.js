"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider } from "../lib/dataProvider";
import { useCertificacion } from "../lib/CertificacionContext";
import { useGastos } from "../lib/GastosContext";
import { useAcciones } from "../lib/AccionesContext";
import { useRegistrarClase } from "../lib/useRegistrarClase";
import { saludoSegunHora } from "../lib/bienvenida";
import { ZONA_ARGENTINA, hoyArgentinaISO, mesArgentinaISO, partesArgentina } from "../lib/fechas";
import { PERIODO_POR_DEFECTO, periodoValido, textoDelTramo } from "../lib/panorama";
import { nombreMes } from "../lib/resumen";
import { calcularInicio, lista, normalizarPanorama, normalizarResumen } from "../lib/inicioDatos";
import { VISTA_POR_DEFECTO, vistaValida } from "../lib/inicioVistas";
import BloqueSeguro from "../components/inicio/BloqueSeguro";
import {
  CertificacionBloque,
  CobrosPorMetodo,
  EstadoCobros,
  FraseInicio,
  GastosPorTipo,
  Indicadores,
  ParaHacer,
  Principal,
  Proximos,
  Proyeccion,
  QuienDebeBloque,
  SelectorPeriodo,
  TresNumeros,
  UltimosMovimientos,
} from "../components/inicio/Bloques";
import { AvisoCopia } from "../components/CopiaSeguridad";
import Enlace from "../components/Enlace";
import { CLAVES_NAVEGADOR, enDemo } from "../lib/navegador";


function fechaLarga(ahora) {
  const t = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA_ARGENTINA,
  })
    .format(ahora)
    .replace(",", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const VISTAS = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "analisis", etiqueta: "Análisis" },
];

// Pestañas Hoy / Análisis: se manejan con flechas, Inicio y Fin.
function Pestanas({ valor, onChange }) {
  function alTeclear(e) {
    const i = VISTAS.findIndex((v) => v.clave === valor);
    let nuevo = null;
    if (e.key === "ArrowRight") nuevo = VISTAS[(i + 1) % VISTAS.length];
    else if (e.key === "ArrowLeft") nuevo = VISTAS[(i + VISTAS.length - 1) % VISTAS.length];
    else if (e.key === "Home") nuevo = VISTAS[0];
    else if (e.key === "End") nuevo = VISTAS[VISTAS.length - 1];
    if (!nuevo) return;
    e.preventDefault();
    onChange(nuevo.clave);
    document.getElementById(`inicio-tab-${nuevo.clave}`)?.focus();
  }
  return (
    <div className="pn-pestanas" role="tablist" aria-label="Vista de Inicio" onKeyDown={alTeclear}>
      {VISTAS.map((v) => (
        <button
          key={v.clave}
          id={`inicio-tab-${v.clave}`}
          type="button"
          role="tab"
          aria-selected={valor === v.clave}
          aria-controls={`inicio-panel-${v.clave}`}
          tabIndex={valor === v.clave ? 0 : -1}
          className={`pn-pestana${valor === v.clave ? " on" : ""}`}
          onClick={() => onChange(v.clave)}
        >
          {v.etiqueta}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const provider = useDataProvider();
  const { version, usuario, abrirCobro, abrirPago, avisar } = useAcciones();
  const registrarClase = useRegistrarClase();
  const { categorias, cargando: cargandoGastos } = useGastos();
  const { cert: certActiva, resumen: certResumen, cargando: cargandoCert } = useCertificacion();
  const mesActual = mesArgentinaISO();
  const hoy = hoyArgentinaISO();

  // El saludo y la fecha dependen de "ahora": se calculan después de montar
  // para que la página prerenderizada (/demo) coincida con la del navegador.
  const [ahora, setAhora] = useState(null);
  const [ahoraInicial] = useState(() => new Date());
  useEffect(() => setAhora(new Date()), []);
  const ahoraEfectivo = ahora || ahoraInicial;

  // El tramo de los gráficos y la pestaña elegida se recuerdan en el navegador
  // (nunca en /demo, que arranca siempre igual).
  const [periodo, setPeriodoEstado] = useState(PERIODO_POR_DEFECTO);
  const [vista, setVistaEstado] = useState(VISTA_POR_DEFECTO);
  useEffect(() => {
    if (enDemo()) return;
    try {
      const guardado = periodoValido(localStorage.getItem(CLAVES_NAVEGADOR.periodoInicio));
      if (guardado) setPeriodoEstado(guardado);
      const vistaGuardada = vistaValida(localStorage.getItem(CLAVES_NAVEGADOR.vistaInicio));
      if (vistaGuardada) setVistaEstado(vistaGuardada);
    } catch {
      // Sin localStorage quedan los valores por defecto.
    }
  }, []);
  function setPeriodo(nuevo) {
    setPeriodoEstado(nuevo);
    try {
      if (!enDemo()) localStorage.setItem(CLAVES_NAVEGADOR.periodoInicio, nuevo);
    } catch {
      // Sin localStorage, dura mientras la app siga abierta.
    }
  }
  function setVista(nueva) {
    setVistaEstado(nueva);
    try {
      if (!enDemo()) localStorage.setItem(CLAVES_NAVEGADOR.vistaInicio, nueva);
    } catch {
      // Sin localStorage, dura mientras la app siga abierta.
    }
  }

  // UNA carga para todo el panel: las cuotas del mes (jugadores y alumnos), el
  // resumen (gastos por pagar, vencimientos, movimientos, certificación) y las
  // vistas mensuales (/api/panorama). Cambiar de tramo no vuelve a pedir nada.
  const [datos, setDatos] = useState(null); // { actual, resumen, errorResumen, panorama, errorPanorama }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      setError("");
      try {
        const aTipo = (tipo) => provider.listarPersonas(tipo, { mes: mesActual }).then((l) => lista(l).map((p) => ({ ...p, tipo })));
        // El resumen y el panorama fallan por separado: si no se pueden leer,
        // Inicio igual muestra lo de las personas.
        const resumenP = provider.obtenerResumen(mesActual).then(
          (resumen) => ({ resumen: normalizarResumen(resumen) }),
          (err) => ({ errorResumen: err.message || "No se pudieron cargar los gastos." })
        );
        const panoramaP = provider.obtenerPanorama().then(
          (panorama) => ({ panorama: normalizarPanorama(panorama) }),
          (err) => ({ errorPanorama: err.message || "No se pudieron cargar los gráficos." })
        );
        const [jug, alu, res, pan] = await Promise.all([aTipo("jugador"), aTipo("alumno"), resumenP, panoramaP]);
        if (!vigente) return;
        setDatos({
          actual: [...jug, ...alu],
          resumen: res.resumen || null,
          errorResumen: res.errorResumen || "",
          panorama: pan.panorama || null,
          errorPanorama: pan.errorPanorama || "",
        });
      } catch (err) {
        if (!vigente) return;
        setDatos(null);
        setError(err.message || "Ocurrió un error de conexión.");
      } finally {
        if (vigente) setLoading(false);
      }
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [provider, mesActual, version]);

  const personas = useMemo(() => lista(datos?.actual), [datos]);
  const resumen = datos?.resumen ?? null;
  const panorama = datos?.panorama ?? null;
  const avance = useMemo(() => lista(certResumen?.avance), [certResumen]);

  const calculos = useMemo(
    () => calcularInicio({ personas, panorama, resumen, categorias: lista(categorias), periodo, mesActual, hoy, ahora: ahoraEfectivo, avance }),
    [personas, panorama, resumen, categorias, periodo, mesActual, hoy, ahoraEfectivo, avance]
  );

  const c = {
    ...calculos,
    datos,
    loading,
    personas,
    resumen,
    panorama,
    sinPanorama: !loading && !panorama,
    periodo,
    mesActual,
    nombreDelMes: nombreMes(mesActual),
    tramo: `vs. el mismo tramo del mes anterior (${textoDelTramo(hoy)})`,
    frasePeriodo: { mes: "este mes", "6m": "los últimos 6 meses", anio: "lo que va del año" }[periodo],
    certActiva,
    cargandoCert,
    avance,
    abrirCobro,
    abrirPago,
    avisar,
    enDemo: enDemo(),
  };

  const saludo = ahora ? `${saludoSegunHora(partesArgentina(ahora).hora)}${usuario?.nombre ? `, ${usuario.nombre}` : ""}` : "";

  // Primeros pasos: se deduce de los datos y desaparece sola al completarse.
  const pasos = [];
  if (datos && personas.length === 0) pasos.push({ href: "/cobros", texto: "Cargar a tus clientes (jugadores y alumnos)" });
  if (!cargandoGastos && lista(categorias).some((x) => x.activo && x.recurrencia !== "ninguna" && x.monto_estimado == null)) {
    pasos.push({ href: "/gastos", texto: "Cargar los montos de tus gastos que se repiten" });
  }
  if (!cargandoCert && datos && !certActiva) pasos.push({ href: "/certificacion", texto: "Crear la certificación" });

  return (
    <>
      <div className="pn-cabecera">
        <div>
          <div className="date">{ahora ? fechaLarga(ahora) : " "}</div>
          <div className="hello">{saludo || " "}</div>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {datos?.errorResumen && (
        <div className="error-banner" role="alert">
          No se pudieron cargar los gastos por pagar ni los vencimientos: {datos.errorResumen}
        </div>
      )}
      {datos?.errorPanorama && (
        <div className="error-banner" role="alert">
          No se pudieron cargar los gráficos: {datos.errorPanorama}
        </div>
      )}

      <BloqueSeguro nombre="Resumen">
        <FraseInicio c={c} />
      </BloqueSeguro>

      <div className="tareas-grandes tareas-compactas" role="group" aria-label="Qué querés registrar">
        <button type="button" className="btn-gold tarea-grande" onClick={() => abrirCobro()}>
          Cobré a alguien
        </button>
        <button type="button" className="btn-gold tarea-grande" onClick={() => abrirPago()}>
          Pagué un gasto
        </button>
        <button type="button" className="btn-gold tarea-grande" onClick={registrarClase}>
          Registré una clase o sesión
        </button>
      </div>

      {pasos.length > 0 && (
        <section className="card primeros-pasos" aria-label="Primeros pasos">
          <h2 className="panel-titulo">Primeros pasos</h2>
          <p className="lbl">Para dejar el sistema listo, te falta:</p>
          <ul className="lista-simple">
            {pasos.map((p) => (
              <li key={p.href}>
                <span>{p.texto}</span>
                <Enlace href={p.href} className="link-action">
                  Ir
                </Enlace>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AvisoCopia />

      <div className="pn-barra-vistas">
        <Pestanas valor={vista} onChange={setVista} />
        {vista === "analisis" && <SelectorPeriodo valor={periodo} onChange={setPeriodo} />}
      </div>

      {vista === "hoy" ? (
        <div className="pn-grid pn-hoy" role="tabpanel" id="inicio-panel-hoy" aria-labelledby="inicio-tab-hoy">
          <BloqueSeguro nombre="Para hacer" className="pn-hacer">
            <ParaHacer c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Quién debe" className="pn-debe-c">
            <QuienDebeBloque c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Los números del mes" className="pn-hoy-num">
            <TresNumeros c={c} />
          </BloqueSeguro>
        </div>
      ) : (
        <div className={`pn-grid${certActiva ? "" : " pn-sin-cert"}`} role="tabpanel" id="inicio-panel-analisis" aria-labelledby="inicio-tab-analisis">
          <BloqueSeguro nombre="Indicadores" className="pn-res">
            <Indicadores c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Ingresos y gastos" className="pn-principal">
            <Principal c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Cobros del mes" className="pn-estado">
            <EstadoCobros c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Gastos por tipo" className="pn-tipo">
            <GastosPorTipo c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Cobros por método" className="pn-metodo">
            <CobrosPorMetodo c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Certificación" className="pn-cert">
            <CertificacionBloque c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Proyección del mes" className="pn-proy">
            <Proyeccion c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Próximos 30 días" className="pn-prox">
            <Proximos c={c} />
          </BloqueSeguro>
          <BloqueSeguro nombre="Últimos movimientos" className="pn-mov">
            <UltimosMovimientos c={c} />
          </BloqueSeguro>
        </div>
      )}
    </>
  );
}
