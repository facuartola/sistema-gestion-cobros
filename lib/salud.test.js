import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIGENCIA_MS, consultarPing, estadoDeSalud, reiniciarCache } from "./salud";

const datos = { url: "https://x.supabase.co", clave: "clave-publica" };
const respuesta = (cuerpo, ok = true) => ({ ok, json: async () => cuerpo });

describe("salud", () => {
  beforeEach(() => reiniciarCache());

  it("llama a rpc/ping con la clave pública y da true si responde ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta("ok"));
    expect(await consultarPing({ ...datos, fetchFn })).toBe(true);
    expect(fetchFn.mock.calls[0][0]).toBe("https://x.supabase.co/rest/v1/rpc/ping");
    expect(fetchFn.mock.calls[0][1].headers.apikey).toBe("clave-publica");
  });

  it("da false ante una respuesta rara, un error HTTP, una excepción o sin configuración", async () => {
    expect(await consultarPing({ ...datos, fetchFn: async () => respuesta("otra cosa") })).toBe(false);
    expect(await consultarPing({ ...datos, fetchFn: async () => respuesta("ok", false) })).toBe(false);
    expect(await consultarPing({ ...datos, fetchFn: async () => { throw new Error("secreto interno"); } })).toBe(false);
    expect(await consultarPing({ url: "", clave: "" })).toBe(false);
  });

  it("guarda el resultado unos 5 minutos y después vuelve a consultar", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta("ok"));
    await estadoDeSalud({ ...datos, fetchFn, ahora: 1000 });
    await estadoDeSalud({ ...datos, fetchFn, ahora: 1000 + VIGENCIA_MS - 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await estadoDeSalud({ ...datos, fetchFn, ahora: 1000 + VIGENCIA_MS + 1 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
