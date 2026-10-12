// Título de pestaña propio y bien distinto del real, para que sea
// imposible confundir esta pestaña con la app real logueada.
export const metadata = {
  title: "DEMO — Sistema de contabilidad (datos de ejemplo)",
  description: "Recorré el sistema completo con datos inventados, sin login y sin tocar ningún dato real.",
};

export default function DemoLayout({ children }) {
  return children;
}
