"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [lista, setLista] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // supabase-js procesa el token de la URL y dispara PASSWORD_RECOVERY
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setLista(true);
    });
    // por si la sesión de recuperación ya estaba activa al montar
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setLista(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setGuardando(false);
    if (error) {
      setError("No se pudo actualizar la contraseña. Pedí un nuevo link e intentá de nuevo.");
    } else {
      setOk(true);
    }
  }

  return (
    <div className="centrado">
      <div className="card tarjeta-login">
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26 }}>
          <span className="brand-mark">C</span>
          <div>
            <p className="brand-title">Contabilidad</p>
            <p className="brand-sub">Coaching deportivo</p>
          </div>
        </div>

        {ok ? (
          <p style={{ lineHeight: 1.6 }}>
            Contraseña actualizada. Ya podés{" "}
            <a href="/" style={{ color: "var(--oro2)", textDecoration: "underline" }}>
              entrar al sistema
            </a>
            .
          </p>
        ) : !lista ? (
          <p style={{ color: "var(--suave)", lineHeight: 1.6 }}>
            Abrí este link desde el email de recuperación para poder cambiar la contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="lbl" htmlFor="nueva-password">
              Contraseña nueva
            </label>
            <input
              id="nueva-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="entrada"
            />
            <label className="lbl" htmlFor="confirmar-password">
              Confirmar contraseña
            </label>
            <input
              id="confirmar-password"
              type="password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              required
              className="entrada"
              style={{ marginBottom: 18 }}
            />
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <button className="btn-gold" type="submit" style={{ width: "100%" }} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
