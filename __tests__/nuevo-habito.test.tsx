import React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import NuevoHabitoScreen from "../app/habito/nuevo";
import {
  confirmarCambioOffline,
  registrarCambioOffline,
} from "../src/services/offline-sync";

jest.mock("../src/services/offline-sync", () => ({
  confirmarCambioOffline: jest.fn(async () => undefined),
  registrarCambioOffline: jest.fn(async () => ({
    id: "cambio-local",
    entidad: "habito",
    operacion: "crear",
    datos: {},
    updated_at: "2026-11-21T10:00:00.000Z",
  })),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

global.fetch = jest.fn();

const URL_BASE = "http://192.168.1.92:3000/api/habito/";

type Peticion = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

const obtenerPeticion = (): [string, Peticion] =>
  (global.fetch as jest.Mock).mock.calls[0] as [string, Peticion];

const renderizar = (): ReactTestRenderer => {
  let arbol: ReactTestRenderer | undefined;

  act(() => {
    arbol = renderer.create(<NuevoHabitoScreen />);
  });

  if (!arbol) {
    throw new Error("No se pudo renderizar la pantalla");
  }

  return arbol;
};

const textosDe = (arbol: ReactTestRenderer): unknown[] =>
  arbol.root.findAllByType(Text).map((nodo) => nodo.props.children);

const escribirNombre = (arbol: ReactTestRenderer, nombre: string): void => {
  act(() => {
    arbol.root
      .findByProps({ testID: "nombre-input" })
      .props.onChangeText(nombre);
  });
};

const pulsarGuardar = async (arbol: ReactTestRenderer): Promise<void> => {
  await act(async () => {
    arbol.root.findByProps({ testID: "guardar-button" }).props.onPress();
  });
};

describe("NuevoHabitoScreen (habito/nuevo.tsx)", () => {
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: replaceMock,
      back: jest.fn(),
    });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("mock-token");
  });

  it("renderiza el formulario con input y botón guardar", () => {
    const arbol = renderizar();

    expect(
      arbol.root.findByProps({ testID: "nombre-input" }).props.placeholder,
    ).toBe("Nombre del hábito");
    expect(textosDe(arbol)).toContain("Guardar");
  });

  it("actualiza el nombre al escribir", () => {
    const arbol = renderizar();

    escribirNombre(arbol, "Beber agua");

    expect(arbol.root.findByProps({ testID: "nombre-input" }).props.value).toBe(
      "Beber agua",
    );
  });

  it.each([200, 201])(
    "actualiza el hábito con PUT (status %i) y vuelve al dashboard",
    async (status) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status,
        json: async () => ({}),
      });
      const arbol = renderizar();

      escribirNombre(arbol, "Beber agua");
      await pulsarGuardar(arbol);

      const [url, peticion] = obtenerPeticion();
      const id = url.slice(URL_BASE.length);

      expect(url.startsWith(URL_BASE)).toBe(true);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(128);
      expect(peticion.method).toBe("PUT");
      expect(peticion.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer mock-token",
      });
      expect(JSON.parse(peticion.body)).toStrictEqual({
        nombre: "Beber agua",
        tipo: "manual",
        meta: 1,
        activo: true,
      });
      expect(registrarCambioOffline).toHaveBeenCalledWith(
        expect.objectContaining({
          entidad: "habito",
          operacion: "crear",
          datos: expect.objectContaining({
            id,
            remote_id: id,
            nombre: "Beber agua",
            deleted: false,
          }),
        }),
      );
      expect(confirmarCambioOffline).toHaveBeenCalledWith("cambio-local");
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    },
  );

  it("no envía nada si el nombre está vacío", async () => {
    const arbol = renderizar();

    await pulsarGuardar(arbol);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(textosDe(arbol)).toContain("El nombre es obligatorio");
  });

  it("muestra un error y no navega si la API falla", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 405,
      json: async () => ({}),
    });
    const arbol = renderizar();

    escribirNombre(arbol, "Beber agua");
    await pulsarGuardar(arbol);

    expect(textosDe(arbol)).toContain("Error al guardar hábito");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
