import React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import EditarHabitoScreen from "../app/habito/editar";
import {
  confirmarCambioOffline,
  registrarCambioOffline,
} from "../src/services/offline-sync";

jest.mock("../src/services/offline-sync", () => ({
  confirmarCambioOffline: jest.fn(async () => undefined),
  registrarCambioOffline: jest.fn(async () => ({
    id: "cambio-local",
    entidad: "habito",
    operacion: "actualizar",
    datos: {},
    updated_at: "2026-11-21T10:00:00.000Z",
  })),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

global.fetch = jest.fn();

const URL_BASE = "http://192.168.1.92:3000/api/habito/";

type ValorParametro = string | string[] | undefined;
type ParametrosRuta = Partial<
  Record<"id" | "nombre" | "meta" | "tipo" | "activo", ValorParametro>
>;
type Peticion = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

const textosDe = (arbol: ReactTestRenderer): string[] =>
  arbol.root
    .findAllByType(Text)
    .map((nodo) =>
      Array.isArray(nodo.props.children)
        ? nodo.props.children.map((hijo: unknown) => String(hijo)).join("")
        : String(nodo.props.children ?? ""),
    );

const renderizar = (parametros: ParametrosRuta): ReactTestRenderer => {
  (useLocalSearchParams as jest.Mock).mockReturnValue(parametros);
  let arbol: ReactTestRenderer | undefined;

  act(() => {
    arbol = renderer.create(<EditarHabitoScreen />);
  });

  if (!arbol) {
    throw new Error("No se pudo renderizar la pantalla");
  }

  return arbol;
};

const pulsarGuardar = async (arbol: ReactTestRenderer): Promise<void> => {
  await act(async () => {
    arbol.root.findByProps({ testID: "guardar-button" }).props.onPress();
  });
};

const obtenerPeticion = (): [string, Peticion] =>
  (global.fetch as jest.Mock).mock.calls[0] as [string, Peticion];

describe("EditarHabitoScreen (habito/editar.tsx)", () => {
  const replaceMock = jest.fn();
  const backMock = jest.fn();
  let arbolActual: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    arbolActual = undefined;
    (useRouter as jest.Mock).mockReturnValue({
      replace: replaceMock,
      back: backMock,
    });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("mock-token");
  });

  afterEach(() => {
    act(() => arbolActual?.unmount());
  });

  const renderizarYGuardar = (
    parametros: ParametrosRuta,
  ): ReactTestRenderer => {
    const arbol = renderizar(parametros);
    arbolActual = arbol;
    return arbol;
  };

  it("precarga nombre y meta desde parámetros simples", () => {
    const arbol = renderizarYGuardar({
      id: "h1",
      nombre: "Beber agua",
      meta: "2",
      tipo: "manual",
      activo: "true",
    });

    expect(arbol.root.findByProps({ testID: "nombre-input" }).props.value).toBe(
      "Beber agua",
    );
    expect(arbol.root.findByProps({ testID: "meta-input" }).props.value).toBe(
      "2",
    );
    expect(textosDe(arbol)).toContain("Guardar");
  });

  it("normaliza parámetros array y valores por defecto en el PUT", async () => {
    const arbol = renderizarYGuardar({
      id: ["h1"],
      nombre: ["Leer"],
      meta: ["3"],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 201,
      json: async () => ({}),
    });

    await pulsarGuardar(arbol);

    const [url, peticion] = obtenerPeticion();
    expect(url).toBe(`${URL_BASE}h1`);
    expect(peticion.method).toBe("PUT");
    expect(peticion.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer mock-token",
    });
    expect(JSON.parse(peticion.body)).toStrictEqual({
      nombre: "Leer",
      tipo: "manual",
      meta: 3,
      activo: true,
    });
    expect(registrarCambioOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: "habito",
        operacion: "actualizar",
        datos: expect.objectContaining({
          id: "h1",
          remote_id: "h1",
          nombre: "Leer",
          deleted: false,
        }),
      }),
    );
    expect(confirmarCambioOffline).toHaveBeenCalledWith("cambio-local");
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("normaliza tipo y activo en false sin any", async () => {
    const arbol = renderizarYGuardar({
      id: "h1",
      nombre: "Meditar",
      meta: "2",
      tipo: ["diario"],
      activo: ["false"],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    });

    await pulsarGuardar(arbol);

    const [, peticion] = obtenerPeticion();
    expect(JSON.parse(peticion.body)).toStrictEqual({
      nombre: "Meditar",
      tipo: "diario",
      meta: 2,
      activo: false,
    });
  });

  it("no envía nada si el nombre está vacío", async () => {
    const arbol = renderizarYGuardar({
      id: "h1",
      nombre: "   ",
      meta: "2",
    });

    await pulsarGuardar(arbol);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(textosDe(arbol)).toContain("El nombre es obligatorio");
  });

  it.each(["0", "1.5", "abc", "-2"])(
    "no envía nada si la meta es inválida (%s)",
    async (meta) => {
      const arbol = renderizarYGuardar({
        id: "h1",
        nombre: "Leer",
        meta,
      });

      await pulsarGuardar(arbol);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(textosDe(arbol)).toContain(
        "La meta debe ser un entero mayor o igual a 1",
      );
    },
  );

  it("no envía nada si falta el id", async () => {
    const arbol = renderizarYGuardar({ nombre: "Leer", meta: "1" });

    await pulsarGuardar(arbol);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(textosDe(arbol)).toContain("No se pudo guardar el hábito");
  });

  it("muestra error sin filtrar el token si la API falla", async () => {
    const arbol = renderizarYGuardar({
      id: "h1",
      nombre: "Leer",
      meta: "2",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 500,
      json: async () => ({}),
    });

    await pulsarGuardar(arbol);

    expect(textosDe(arbol)).toContain("No se pudo guardar el hábito");
    expect(textosDe(arbol).join(" ")).not.toContain("mock-token");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("muestra error de conexión sin navegar", async () => {
    const arbol = renderizarYGuardar({
      id: "h1",
      nombre: "Leer",
      meta: "2",
    });
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network"));

    await pulsarGuardar(arbol);

    expect(textosDe(arbol)).toContain("Error de conexión");
    expect(textosDe(arbol).join(" ")).not.toContain("mock-token");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
