"use client";

import { formatoDolares } from "../../lib/moneda";
import { ETIQUETA_METODO } from "../../lib/metodoPago";
import Avatar from "../Avatar";
import Enlace from "../Enlace";
import { IconoCampana } from "../Iconos";

const MES_CORTO = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
function diaDeFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return { fecha: new Date(Date.UTC(y, m - 1, d)), dia: d };
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// "Últimos movimientos": los últimos cobros y pagos registrados, con signo,
// fecha y método.
export function Movimientos({ items }) {
  return (
    <ul className="mini pn-mini">
      {items.map((m) => {
        const { fecha, dia } = diaDeFecha(m.fecha);
        return (
          <li key={m.clave}>
            <div className="cuando">
              <b className="num">{dia}</b>
              {MES_CORTO.format(fecha).replace(".", "")}
            </div>
            <div className="que">
              <div>{m.nombre}</div>
              <div className="lbl">
                {m.tipo === "cobro" ? "Cobro" : "Pago"}, {ETIQUETA_METODO[m.metodo] || "sin método"}
              </div>
            </div>
            <div className={`monto${m.tipo === "cobro" ? " mas" : ""}`}>
              {m.tipo === "cobro" ? "+" : "−"}
              {formatoDolares(m.monto)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Una fila de "Para hacer": un cobro, un gasto, un recordatorio o algo de la certificación.
export function FilaPendiente({ item, ocupado, onCobrar, onPagar, onHecho }) {
  const aviso =
    item.tipo === "cobro"
      ? `Registrar cobro de ${item.nombre}`
      : item.tipo === "gasto"
        ? `Registrar pago de ${item.nombre}`
        : `Marcar como hecho: ${item.titulo}`;
  return (
    <li className="row">
      {item.nombre ? (
        <Avatar nombre={item.nombre} />
      ) : (
        <Avatar nombre={item.titulo} color="#2A3B5C">
          <IconoCampana size={15} />
        </Avatar>
      )}
      <div>
        <div className="row-titulo">{item.titulo}</div>
        <div className="row-sub">{item.detalle}</div>
      </div>
      <div className="amt num">{item.monto != null ? formatoDolares(item.monto) : ""}</div>
      <span className={`pill ${item.tono}`}>{item.etiqueta}</span>
      {item.tipo === "cobro" ? (
        <button type="button" className="btn-gold btn-sm" aria-label={aviso} onClick={() => onCobrar(item)}>
          Registrar cobro
        </button>
      ) : item.href ? (
        <Enlace href={item.href} className={`${item.tipo === "certificar" ? "btn-ghost" : "btn-gold"} btn-sm`} aria-label={`${item.accion}: ${item.titulo}`}>
          {item.accion}
        </Enlace>
      ) : item.tipo === "gasto" ? (
        <button type="button" className="btn-ghost btn-sm" aria-label={aviso} onClick={() => onPagar(item)}>
          Registrar pago
        </button>
      ) : (
        <button type="button" className="btn-ghost btn-sm" aria-label={aviso} disabled={ocupado} onClick={() => onHecho(item)}>
          Hecho
        </button>
      )}
    </li>
  );
}

function textoDeuda(f) {
  const partes = [];
  if (f.meses > 1 || !f.puedeCobrar) partes.push(`debe ${plural(f.meses, "mes", "meses")}`);
  if (f.diasAtraso != null) partes.push(f.diasAtraso === 0 ? "vence hoy" : `${plural(f.diasAtraso, "día", "días")} de atraso`);
  return partes.join(" · ");
}

// "Quién debe": los clientes con deuda, de los más antiguos a los más nuevos.
// "Cobré" registra la cuota de este mes; si la deuda es de meses anteriores se
// va a Cobros, donde se elige qué cuota es.
export function QuienDebe({ datos, onCobrar }) {
  return (
    <>
      <ul className="pn-debe">
        {datos.items.map((f) => (
          <li key={`${f.persona.tipo}-${f.persona.id}`}>
            <Avatar nombre={f.persona.nombre} />
            <div className="pn-debe-texto">
              <div className="row-titulo">{f.persona.nombre}</div>
              <div className="row-sub">{textoDeuda(f)}</div>
            </div>
            <div className="pn-debe-monto num">{formatoDolares(f.monto)}</div>
            {f.puedeCobrar ? (
              <button type="button" className="btn-gold btn-sm" aria-label={`Cobré a ${f.persona.nombre}`} onClick={() => onCobrar(f.persona)}>
                Cobré
              </button>
            ) : (
              <Enlace href={`/cobros?tipo=${f.persona.tipo}`} className="btn-ghost btn-sm" aria-label={`Ver a ${f.persona.nombre} en Cobros`}>
                Ver
              </Enlace>
            )}
          </li>
        ))}
      </ul>
      <div className="pn-pie-lista">
        <Enlace href="/cobros" className="link-action">
          {datos.total > datos.items.length ? `Ver los ${datos.total} en Cobros` : "Ver Cobros"}
        </Enlace>
      </div>
    </>
  );
}
