// Lo que la app guarda en el navegador (localStorage y sessionStorage) y la
// detección del modo demo, en un solo lugar. Todo es una comodidad por persona:
// nada de esto se lee desde la base, y /demo no guarda nada.
export const RUTA_DEMO = "/demo";

export const CLAVES_NAVEGADOR = {
  periodoInicio: "inicio_periodo",
  vistaInicio: "inicio_vista",
  hacerOculto: "inicio_hacer_oculto",
  mesElegido: "mes_elegido", // sessionStorage
  pestanaCobros: "cobros_pestana",
  pestanaCertificacion: "certificacion_pestana",
  certificacionElegida: "certificacion_elegida",
  ultimaCopia: "ultima_copia",
  ultimoMetodoPago: "ultimo_metodo_pago",
  sesionExpirada: "sesion_expirada", // sessionStorage
};

export function enDemo() {
  return typeof window !== "undefined" && window.location.pathname === RUTA_DEMO;
}
