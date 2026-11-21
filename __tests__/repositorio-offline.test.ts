import {
  encolarCambio,
  listarPendientes,
  marcarSincronizado,
  rutaSincronizacion,
  type BaseOffline,
} from "../src/repositories/offline";

describe("repositorio offline", () => {
  const cambio = {
    id: "c1",
    entidad: "registro" as const,
    operacion: "crear" as const,
    datos: { fecha: "2026-11-21" },
  };

  let base: BaseOffline;

  beforeEach(() => {
    base = {
      execAsync: jest.fn(async () => undefined),
      getAllAsync: jest.fn(async () => []),
    };
  });

  it("encola un cambio con updated_at", async () => {
    const guardado = await encolarCambio(base, cambio, "2026-11-21T10:00:00Z");

    expect(guardado.updated_at).toBe("2026-11-21T10:00:00Z");
    expect(base.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cambios_pendientes"),
    );
  });

  it("consulta pendientes usando since", async () => {
    await listarPendientes(base, "2026-11-20");

    expect(base.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("pending = 1"),
      ["2026-11-20"],
    );
    expect(rutaSincronizacion("/api/habito", "2026-11-20")).toBe(
      "/api/habito?since=2026-11-20",
    );
  });

  it("marca un cambio como sincronizado", async () => {
    await marcarSincronizado(base, "c1");

    expect(base.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("pending = 0"),
    );
  });
});
