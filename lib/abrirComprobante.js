// Abre el comprobante de un pago en otra pestaña con una URL firmada de corta
// duración (el bucket es privado). La pestaña se abre antes de pedir la URL, en
// el mismo click, para que el navegador no la tome por una ventana emergente
// no pedida. Tira un Error en castellano si algo falla.
export async function abrirComprobante(provider, pagoId) {
  const ventana = window.open("about:blank", "_blank");
  if (!ventana) throw new Error("El navegador bloqueó la nueva pestaña. Permitila para ver el comprobante.");
  try {
    const { url } = await provider.urlComprobante(pagoId);
    ventana.opener = null;
    ventana.location.href = url;
  } catch (err) {
    ventana.close();
    throw err;
  }
}
