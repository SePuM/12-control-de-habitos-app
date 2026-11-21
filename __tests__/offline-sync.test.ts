import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

import { peticionAutenticada } from "../src/api/sesion";
import {
  confirmarCambioOffline,
  guardarHabilidadesLocales,
  leerHabilidadesLocales,
  registrarCambioOffline,
  sincronizarCambios,
} from "../src/services/offline-sync";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn() }));
jest.mock("../src/api/sesion", () => ({ peticionAutenticada: jest.fn() }));

type BaseMock = { execAsync: jest.Mock; getAllAsync: jest.Mock };

const base: BaseMock = {
  execAsync: jest.fn(async () => undefined),
  getAllAsync: jest.fn(async () => []),
};

describe("servicio offline conectado", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(base);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("token");
    (peticionAutenticada as jest.Mock).mockResolvedValue({ status: 200 });
    base.execAsync.mockResolvedValue(undefined);
    base.getAllAsync.mockResolvedValue([]);
  });

  it("guarda hábitos con remote_id, deleted, pending y updated_at", async () => {
    await guardarHabilidadesLocales(
      [{ id: "h1", _id: "remoto-1", nombre: "Leer", meta: 2 }],
      "2026-11-21T10:00:00.000Z",
    );

    const sql = String(base.execAsync.mock.calls[1][0]);
    expect(sql).toContain("remote_id");
    expect(sql).toContain("deleted = 0");
    expect(sql).toContain("pending = 0");
    expect(sql).toContain("updated_at");
    expect(sql).toContain("'h1'");
    expect(sql).toContain("'remoto-1'");
    expect(sql).toContain("'Leer'");
    expect(sql).toContain("2");
    expect(sql).toContain("'2026-11-21T10:00:00.000Z'");
  });

  it("lee hábitos locales excluyendo eliminados", async () => {
    base.getAllAsync.mockResolvedValue([
      {
        id: "h1",
        remote_id: "remoto-1",
        nombre: "Leer",
        meta: 3,
        deleted: 0,
      },
    ]);

    const habitos = await leerHabilidadesLocales();

    expect(String(base.getAllAsync.mock.calls[0][0])).toContain("deleted = 0");
    expect(habitos).toEqual([
      { id: "h1", _id: "remoto-1", nombre: "Leer", meta: 3 },
    ]);
  });

  it("encola cambios con updated_at y remote_id", async () => {
    const cambio = await registrarCambioOffline(
      {
        entidad: "registro",
        operacion: "crear",
        datos: { habitoId: "h1", fecha: "2026-11-21", remote_id: "remoto-1" },
      },
      "2026-11-21T10:00:00.000Z",
    );

    expect(cambio.updated_at).toBe("2026-11-21T10:00:00.000Z");
    expect(String(base.execAsync.mock.calls[1][0])).toContain(
      "INSERT INTO cambios_pendientes",
    );
    expect(String(base.execAsync.mock.calls[1][0])).toContain("remoto");
    expect(String(base.execAsync.mock.calls[1][0])).toContain("remote_id");
  });

  it("confirma un cambio como sincronizado", async () => {
    await confirmarCambioOffline("c1");

    expect(String(base.execAsync.mock.calls[1][0])).toContain("pending = 0");
  });

  it("sincroniza pendientes usando ?since= y marca el cambio", async () => {
    base.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("sincronizaciones")) {
        return [{ valor: "2026-11-20T00:00:00.000Z" }];
      }
      if (sql.includes("cambios_pendientes")) {
        return [
          {
            id: "c1",
            entidad: "registro",
            operacion: "crear",
            datos: JSON.stringify({
              habitoId: "h1",
              fecha: "2026-11-21",
              remote_id: "h1",
              deleted: false,
            }),
            updated_at: "2026-11-21T10:00:00.000Z",
          },
        ];
      }
      return [];
    });

    const sincronizados = await sincronizarCambios();

    expect(sincronizados).toBe(1);
    expect(peticionAutenticada).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/registro_habito/h1/2026-11-21?since=2026-11-20T00%3A00%3A00.000Z",
      ),
      expect.objectContaining({ method: "PUT" }),
    );
    expect(
      base.execAsync.mock.calls.some((llamada) =>
        String(llamada[0]).includes("pending = 0"),
      ),
    ).toBe(true);
  });
});
