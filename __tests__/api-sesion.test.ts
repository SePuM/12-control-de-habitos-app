import * as SecureStore from "expo-secure-store";

import {
  guardarSesion,
  limpiarSesion,
  peticionAutenticada,
  renovarSesion,
} from "../src/api/sesion";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

global.fetch = jest.fn();

const API_BASE = "http://192.168.1.92:3000";

const respuesta = (status: number, datos: unknown = {}) => ({
  status,
  json: async () => datos,
});

const llamadaFetch = (): [
  string,
  { method: string; headers: Record<string, string>; body?: string },
] =>
  (global.fetch as jest.Mock).mock.calls[0] as [
    string,
    { method: string; headers: Record<string, string>; body?: string },
  ];

describe("sesión y renovación de token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it("guarda token y refreshToken cuando vienen en la respuesta", async () => {
    const guardado = await guardarSesion({
      token: "nuevo-token",
      refreshToken: "nuevo-refresh",
    });

    expect(guardado).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "token",
      "nuevo-token",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refreshToken",
      "nuevo-refresh",
    );
  });

  it("no guarda una sesión sin token", async () => {
    const guardado = await guardarSesion({ token: "", refreshToken: "r" });

    expect(guardado).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("limpia token y refreshToken", async () => {
    await limpiarSesion();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refreshToken");
  });

  it("renueva con refreshToken guardado y conserva el refresh si no vuelve", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("refresh-viejo");
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta(200, { token: "token-renovado" }),
    );

    const renovada = await renovarSesion();

    expect(renovada).toBe(true);
    expect(llamadaFetch()[0]).toBe(`${API_BASE}/api/auth/refresh`);
    expect(JSON.parse(llamadaFetch()[1].body ?? "{}")).toStrictEqual({
      refreshToken: "refresh-viejo",
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "token",
      "token-renovado",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refreshToken",
      "refresh-viejo",
    );
  });

  it("no renueva si el refresh devuelve 401", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("refresh-viejo");
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta(401));

    const renovada = await renovarSesion();

    expect(renovada).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("no renueva si no hay refreshToken guardado", async () => {
    const renovada = await renovarSesion();

    expect(renovada).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("no vuelve a llamar al endpoint si la respuesta no es 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta(200));

    const resultado = await peticionAutenticada(`${API_BASE}/api/habito`, {
      method: "GET",
      headers: { Authorization: "Bearer token-viejo" },
    });

    expect(resultado.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("renueva una vez y reintenta con el nuevo token ante 401", async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce("refresh-guardado")
      .mockResolvedValueOnce("token-renovado");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respuesta(401))
      .mockResolvedValueOnce(respuesta(200, { token: "token-renovado" }))
      .mockResolvedValueOnce(respuesta(200));

    const alExpirar = jest.fn();
    const resultado = await peticionAutenticada(
      `${API_BASE}/api/habito`,
      { method: "GET", headers: { Authorization: "Bearer token-viejo" } },
      alExpirar,
    );

    expect(resultado.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const reintento = (global.fetch as jest.Mock).mock.calls[2] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(reintento[1].headers.Authorization).toBe("Bearer token-renovado");
    expect(alExpirar).not.toHaveBeenCalled();
  });

  it("limpia la sesión y avisa si falla la renovación", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("refresh-viejo");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respuesta(401))
      .mockResolvedValueOnce(respuesta(401));

    const alExpirar = jest.fn();
    await peticionAutenticada(
      `${API_BASE}/api/habito`,
      { method: "GET", headers: { Authorization: "Bearer token-viejo" } },
      alExpirar,
    );

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refreshToken");
    expect(alExpirar).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
