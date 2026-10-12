// Los pagos son en dólares: todos los montos se muestran como "US$ 1.234"
// (o "US$ 1.234,50" si tienen centavos), con separadores de es-AR. Un solo
// lugar para cambiar el formato si hiciera falta.
const SIN_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const CON_CENTAVOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatoDolares(monto) {
  const n = Number(monto);
  if (!Number.isFinite(n)) return SIN_CENTAVOS.format(0);
  // Los centavos solo se muestran si existen: US$ 50 y no US$ 50,00.
  return Math.abs(n - Math.round(n)) < 0.005 ? SIN_CENTAVOS.format(Math.round(n)) : CON_CENTAVOS.format(n);
}
