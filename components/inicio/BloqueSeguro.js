"use client";

import { Component } from "react";
import { registrarErrorFrontend } from "../../lib/registrarErrorFrontend";

// Límite de error de UN bloque de Inicio: si un gráfico o una lista falla al
// dibujarse, el resto de la pantalla sigue y este bloque muestra un mensaje
// amable con "Reintentar". Conserva `className` para no mover la grilla.
export default class BloqueSeguro extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
    this.reintentar = this.reintentar.bind(this);
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    const ruta = typeof window !== "undefined" ? window.location.pathname : "/";
    // Solo el primer renglón del rastro, para no llenar el registro.
    registrarErrorFrontend({ mensaje: `[${this.props.nombre || "bloque"}] ${error?.message || "error"}`, stack: error?.stack, ruta });
  }

  reintentar() {
    this.setState({ fallo: false });
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    const { nombre = "Este bloque", className = "" } = this.props;
    return (
      <section className={`card pn-bloque-fallo ${className}`} role="alert">
        <h2 className="panel-titulo">{nombre}</h2>
        <p>No se pudo mostrar esta parte. El resto de la pantalla sigue funcionando.</p>
        <button type="button" className="btn-ghost btn-sm" onClick={this.reintentar}>
          Reintentar
        </button>
      </section>
    );
  }
}
