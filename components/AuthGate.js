"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useFocusTrap } from "../lib/useFocusTrap";
import { nombreParaEmail, textoBienvenida } from "../lib/bienvenida";
import Bienvenida from "./Bienvenida";
import { RecordatoriosProvider } from "../lib/RecordatoriosContext";
import { NavProvider } from "../lib/NavContext";
import AccionesProvider from "./AccionesProvider";
import Shell from "./Shell";
import { CLAVES_NAVEGADOR, RUTA_DEMO } from "../lib/navegador";

// Id de la sesión de login (claim session_id del token de Supabase): cambia
// con cada inicio de sesión y se mantiene al renovar el token.
function idDeSesion(s) {
  try {
    const payload = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).session_id || null;
  } catch {
    return null;
  }
}

// El saludo aparece una sola vez por sesión de login. supabase-js puede
// volver a emitir SIGNED_IN (por ejemplo al volver a enfocar la pestaña),
// así que se anota en sessionStorage qué sesión ya fue saludada.
function marcarSaludada(s) {
  const id = idDeSesion(s);
  if (!id) return true;
  try {
    const clave = `bienvenida_${id}`;
    if (sessionStorage.getItem(clave) === "1") return false;
    sessionStorage.setItem(clave, "1");
  } catch {
    // sessionStorage no disponible: se saluda igual, a lo sumo dos veces.
  }
  return true;
}

export default function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [modo, setModo] = useState("login"); // "login" | "olvide" | "olvide-enviado"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [avisoSesion, setAvisoSesion] = useState("");
  // Sesión perdida sin que la clienta haya tocado "Cerrar sesión" (token vencido,
  // 401 del backend): { id, email } del usuario que estaba adentro. Mientras
  // tanto la app queda montada e inerte debajo del login, así un formulario a
  // medio cargar (un modal abierto, un recordatorio sin guardar) no se pierde.
  const [reingreso, setReingreso] = useState(null);
  const [bienvenida, setBienvenida] = useState(null); // { titulo, subtitulo }
  const usuarioRef = useRef(null);
  const cierreVoluntarioRef = useRef(false);
  const appRef = useRef(null);
  const reingresoRef = useRef(null);
  const passwordRef = useRef(null);

  const esDemo = pathname === RUTA_DEMO;
  const pidiendoReingreso = Boolean(reingreso) && !session;

  useEffect(() => {
    // /demo es pública y no debe hacer ningún request a Supabase, ni
    // siquiera el getSession() inicial (puede disparar un refresh de
    // token por red). Se corta antes de tocar el cliente de Supabase.
    if (esDemo) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((evento, s) => {
      if (s) {
        // Saludo solo al pasar de "sin sesión" a "con sesión" en esta visita:
        // no al abrir la app ya logueada (INITIAL_SESSION), ni al renovar el
        // token, ni al volver a entrar después de un vencimiento (ahí
        // usuarioRef todavía tiene al usuario y lo importante es seguir).
        if (evento === "SIGNED_IN" && !usuarioRef.current && marcarSaludada(s)) {
          setBienvenida(textoBienvenida(s.user.email));
        }
        usuarioRef.current = { id: s.user.id, email: s.user.email ?? "" };
        cierreVoluntarioRef.current = false;
        setAvisoSesion(""); // si no, reaparecía en el próximo "Cerrar sesión"
        // Si entró la misma cuenta, la app sigue tal cual. Si entró otra,
        // la key del contenedor cambia y la app se remonta desde cero: no se
        // le muestran a nadie datos cargados por otra cuenta.
        setReingreso(null);
      } else if (usuarioRef.current && !cierreVoluntarioRef.current) {
        setReingreso(usuarioRef.current);
        setEmail(usuarioRef.current.email);
        setPassword("");
        setModo("login");
        setError("");
      } else {
        usuarioRef.current = null;
        setReingreso(null);
      }
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
    // Depende de esDemo y no de pathname: la app navega con next/link, así
    // que AuthGate no se remonta al cambiar de página y alcanza con UNA
    // suscripción para toda la visita. Si alguien sale de /demo sin recargar,
    // esDemo cambia y recién ahí se suscribe (si no, quedaría "cargando").
  }, [esDemo]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLAVES_NAVEGADOR.sesionExpirada) === "1") {
        setAvisoSesion("Tu sesión venció. Iniciá sesión de nuevo para continuar.");
        sessionStorage.removeItem(CLAVES_NAVEGADOR.sesionExpirada);
      }
    } catch {
      // sessionStorage no disponible: no mostramos el aviso, no rompe nada.
    }
  }, [session]);

  // Mientras se pide reingresar, lo de atrás no recibe foco, clicks ni
  // lectores de pantalla (inert), y Escape no le llega: el modal de cliente
  // se cierra con Escape desde document y se perdería lo cargado.
  useEffect(() => {
    const app = appRef.current;
    if (!app) return undefined;
    app.inert = pidiendoReingreso;
    if (!pidiendoReingreso) return undefined;
    function frenarEscape(e) {
      if (e.key === "Escape") e.stopImmediatePropagation();
    }
    window.addEventListener("keydown", frenarEscape, true);
    return () => window.removeEventListener("keydown", frenarEscape, true);
  }, [pidiendoReingreso]);

  useFocusTrap(reingresoRef, pidiendoReingreso);

  // El email ya viene cargado: el foco va directo a la contraseña.
  useEffect(() => {
    if (pidiendoReingreso) passwordRef.current?.focus();
  }, [pidiendoReingreso]);

  // La página de restablecer contraseña maneja su propia sesión de recuperación,
  // sin el shell de la app alrededor (sidebar, nav) ni el gate normal.
  if (pathname === "/reset-password") {
    return children;
  }

  // /demo es pública a propósito: sin login, sin este shell, sin ninguna
  // llamada a la API real (usa lib/dataProviderDemo.js). Nunca debe pasar
  // por el gate de sesión.
  if (pathname === RUTA_DEMO) {
    return children;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoadingLogin(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoadingLogin(false);
    if (!error) return;
    // Antes cualquier falla decía "contraseña incorrecta", incluso sin
    // internet o con Supabase pausado: la clienta podía pensar que se olvidó la
    // clave cuando en realidad era la conexión.
    if (error.code === "email_not_confirmed") {
      setError("Tu email todavía no está confirmado. Revisá tu casilla (y la carpeta de spam).");
    } else if (error.status === 400 || error.code === "invalid_credentials") {
      setError("Email o contraseña incorrectos.");
    } else {
      setError("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo en un momento.");
    }
  }

  async function handleOlvide(e) {
    e.preventDefault();
    setError("");
    setLoadingLogin(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    setLoadingLogin(false);
    if (error) {
      setError("No se pudo enviar el email. Revisá la dirección.");
    } else {
      setModo("olvide-enviado");
    }
  }

  async function handleLogout() {
    cierreVoluntarioRef.current = true;
    // Si el servidor no responde (sin internet, Supabase pausado),
    // supabase-js devuelve un error y CONSERVA la sesión: el botón no hacía
    // nada visible. En ese caso se cierra igual en este navegador.
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
  }

  if (session === undefined) {
    return (
      <div className="pantalla-carga" role="status">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }

  async function entrarConOtraCuenta() {
    // Descarta lo que había quedado montado: vuelve al login normal.
    cierreVoluntarioRef.current = true;
    usuarioRef.current = null;
    setReingreso(null);
    setEmail("");
    setPassword("");
    setError("");
    setAvisoSesion("");
  }

  const emailActual = session?.user.email ?? reingreso?.email ?? "";
  const usuario = { nombre: nombreParaEmail(emailActual), detalle: emailActual };

  const tarjetaLogin = (
    <div className="card tarjeta-login">
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26 }}>
        <span className="brand-mark">C</span>
        <div>
          <p className="brand-title">Contabilidad</p>
          <p className="brand-sub">Coaching deportivo</p>
        </div>
      </div>

      {pidiendoReingreso ? (
        <div className="notice-banner" role="status" style={{ marginBottom: 18 }}>
          Tu sesión venció. Volvé a entrar: lo que estabas cargando sigue en pantalla y lo vas a poder guardar.
        </div>
      ) : (
        avisoSesion && <div className="notice-banner" role="status" style={{ marginBottom: 18 }}>{avisoSesion}</div>
      )}

      {modo === "olvide-enviado" ? (
        <>
          <p style={{ lineHeight: 1.6, marginBottom: 18 }}>
            Si el email existe, te llegó un link para elegir una contraseña nueva.
          </p>
          <button
            className="btn-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              setModo("login");
              setError("");
            }}
          >
            Volver al inicio de sesión
          </button>
        </>
      ) : modo === "olvide" ? (
        <form onSubmit={handleOlvide}>
          <label className="lbl" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="entrada"
          />
          {error && <p className="error-banner" role="alert">{error}</p>}
          <button className="btn-gold" type="submit" style={{ width: "100%" }} disabled={loadingLogin}>
            {loadingLogin ? "Enviando…" : "Enviar link de recuperación"}
          </button>
          <button
            type="button"
            className="link-action"
            style={{ display: "block", margin: "14px auto 0" }}
            onClick={() => {
              setModo("login");
              setError("");
            }}
          >
            Volver
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin}>
          <label className="lbl" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="entrada"
          />

          <label className="lbl" htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="entrada"
            style={{ marginBottom: 10 }}
          />

          <button
            type="button"
            className="link-action"
            style={{ display: "block", marginBottom: 14 }}
            onClick={() => {
              setModo("olvide");
              setError("");
            }}
          >
            Olvidé mi contraseña
          </button>

          {error && <p className="error-banner" role="alert">{error}</p>}

          <button className="btn-gold" type="submit" style={{ width: "100%" }} disabled={loadingLogin}>
            {loadingLogin ? "Entrando…" : "Entrar"}
          </button>
        </form>
      )}
      {pidiendoReingreso && (
        <button
          type="button"
          className="link-action"
          style={{ display: "block", margin: "14px auto 0" }}
          onClick={entrarConOtraCuenta}
        >
          Entrar con otra cuenta (se descarta lo que no se guardó)
        </button>
      )}
    </div>
  );

  if (!session && !reingreso) {
    return <div className="centrado">{tarjetaLogin}</div>;
  }

  return (
    <>
      <div ref={appRef} key={session?.user.id ?? reingreso.id} style={{ display: "contents" }}>
        <RecordatoriosProvider>
          <NavProvider ruta={pathname} ir={(href) => router.push(href)}>
            <AccionesProvider usuario={{ email: emailActual, nombre: nombreParaEmail(emailActual) }}>
              <Shell usuario={usuario} onSalir={handleLogout}>
                {children}
              </Shell>
            </AccionesProvider>
          </NavProvider>
        </RecordatoriosProvider>
      </div>
      {bienvenida && (
        <Bienvenida
          titulo={bienvenida.titulo}
          subtitulo={bienvenida.subtitulo}
          onCerrar={() => setBienvenida(null)}
        />
      )}
      {pidiendoReingreso && (
        <div
          ref={reingresoRef}
          className="reingreso-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Volver a iniciar sesión"
        >
          {tarjetaLogin}
        </div>
      )}
    </>
  );
}
