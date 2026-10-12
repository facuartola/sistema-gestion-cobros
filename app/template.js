// template.js (a diferencia de layout.js) se vuelve a montar en cada
// navegación: eso es lo que dispara la animación de entrada de la página, una
// sola vez por pantalla (.enter en app/globals.css). CSS puro, sin JS.
export default function Template({ children }) {
  return <div className="enter">{children}</div>;
}
