import * as SecureStore from "expo-secure-store";

import { API_BASE } from "./config";

export type DatosSesion = {
  token?: unknown;
  refreshToken?: unknown;
};

export type OpcionesPeticion = {
  method: string;
  headers: Record<string, string>;
  body?: string;
};

const textoNoVacio = (valor: unknown): string | null =>
  typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;

export const guardarSesion = async (datos: DatosSesion): Promise<boolean> => {
  const token = textoNoVacio(datos.token);
  if (!token) return false;

  await SecureStore.setItemAsync("token", token);
  const refreshToken = textoNoVacio(datos.refreshToken);
  if (refreshToken) {
    await SecureStore.setItemAsync("refreshToken", refreshToken);
  }
  return true;
};

export const limpiarSesion = async (): Promise<void> => {
  await SecureStore.deleteItemAsync("token");
  await SecureStore.deleteItemAsync("refreshToken");
};

export const renovarSesion = async (): Promise<boolean> => {
  try {
    const refreshToken = await SecureStore.getItemAsync("refreshToken");
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status !== 200 && response.status !== 201) return false;

    const datos = (await response.json()) as DatosSesion;
    return guardarSesion({
      ...datos,
      refreshToken: textoNoVacio(datos.refreshToken) ?? refreshToken,
    });
  } catch {
    return false;
  }
};

export const peticionAutenticada = async (
  url: string,
  opciones: OpcionesPeticion,
  alExpirar?: () => void,
): Promise<Response> => {
  const respuesta = await fetch(url, opciones);
  if (respuesta.status !== 401) return respuesta;

  const renovada = await renovarSesion();
  if (!renovada) {
    await limpiarSesion();
    alExpirar?.();
    return respuesta;
  }

  const token = await SecureStore.getItemAsync("token");
  return fetch(url, {
    ...opciones,
    headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
  });
};
