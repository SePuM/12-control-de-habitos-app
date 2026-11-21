import React from "react";
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useRouter } from "expo-router";

import DashboardScreen from "../app/dashboard";
import {
  confirmarCambioOffline,
  guardarHabilidadesLocales,
  leerHabilidadesLocales,
  registrarCambioOffline,
  sincronizarCambios,
} from "../src/services/offline-sync";
import { usePedometro } from "../src/sensors/use-pedometro";

jest.mock("../src/services/offline-sync", () => ({
  confirmarCambioOffline: jest.fn(async () => undefined),
  guardarHabilidadesLocales: jest.fn(async () => undefined),
  leerHabilidadesLocales: jest.fn(async () => []),
  registrarCambioOffline: jest.fn(async () => ({
    id: "cambio-local",
    entidad: "registro",
    operacion: "crear",
    datos: {},
    updated_at: "2026-11-21T10:00:00.000Z",
  })),
  sincronizarCambios: jest.fn(async () => 0),
}));

jest.mock("../src/sensors/use-pedometro", () => ({
  usePedometro: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn((cb: () => void | Promise<void>) => {
    (globalThis as GlobalConFocus).mockFocusCallback = cb;
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

global.fetch = jest.fn();

const API_BASE = "http://192.168.1.92:3000";

type HabitoMock = {
  id?: string;
  _id?: string;
  nombre: string;
  racha?: number;
  meta?: number;
};

type RegistroMock = {
  habitoId: string;
  deleted_at?: string | null;
};

type GlobalConFocus = {
  mockFocusCallback?: () => void | Promise<void>;
};

const globalConFocus = globalThis as GlobalConFocus;

const HABITOS: HabitoMock[] = [
  { id: "h1", nombre: "Beber agua", racha: 5, meta: 2 },
  { id: "h2", nombre: "Leer", racha: 10 },
];

const fechaLocalEsperada = (): string => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const configurarFetch = (
  registros: RegistroMock[],
  statusRegistros = 200,
  estadisticas: unknown = [],
  statusEstadisticas = 200,
): void => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes("/api/registro_habito/estadisticas?")) {
      return Promise.resolve({
        status: statusEstadisticas,
        json: async () => estadisticas,
      });
    }
    if (url.includes("/api/registro_habito?")) {
      return Promise.resolve({
        status: statusRegistros,
        json: async () => registros,
      });
    }
    return Promise.resolve({ status: 200, json: async () => HABITOS });
  });
};

const textoDeChildren = (children: unknown): string =>
  Array.isArray(children)
    ? children.map((hijo) => String(hijo)).join("")
    : String(children ?? "");

const textosDe = (arbol: ReactTestRenderer): string[] =>
  arbol.root
    .findAllByType(Text)
    .map((nodo) => textoDeChildren(nodo.props.children));

const urlDeRegistro = (fecha: string): string =>
  `${API_BASE}/api/registro_habito?fecha=${fecha}`;

const urlDeEstadisticas = (fecha: string): string =>
  `${API_BASE}/api/registro_habito/estadisticas?fecha=${fecha}`;

describe("DashboardScreen - registros de hoy", () => {
  let arbolActual: ReactTestRenderer | undefined;
  let pushMock: jest.Mock;
  let replaceMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    globalConFocus.mockFocusCallback = undefined;
    arbolActual = undefined;
    pushMock = jest.fn();
    replaceMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: pushMock,
      replace: replaceMock,
      back: jest.fn(),
    });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("mock-token");
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (usePedometro as jest.Mock).mockReturnValue({
      estado: "activo",
      pasos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual: jest.fn(),
      detener: jest.fn(),
    });
  });

  afterEach(() => {
    act(() => arbolActual?.unmount());
  });

  const renderizar = async (): Promise<ReactTestRenderer> => {
    let arbol: ReactTestRenderer | undefined;

    act(() => {
      arbol = renderer.create(<DashboardScreen />);
    });

    if (!arbol) {
      throw new Error("No se pudo renderizar el Dashboard");
    }

    arbolActual = arbol;
    const ejecutarFocus = globalConFocus.mockFocusCallback;

    if (!ejecutarFocus) {
      throw new Error("useFocusEffect no registró su callback");
    }

    await act(async () => {
      await ejecutarFocus();
    });

    return arbol;
  };

  const pulsar = (arbol: ReactTestRenderer, testID: string): void => {
    const boton = arbol.root.findByProps({ testID });
    act(() => {
      boton.props.onPress();
    });
  };

  const esperarAccion = async (): Promise<void> => {
    for (let intento = 0; intento < 3; intento += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const configurarRecarga = (racha: number, statusAccion = 201): void => {
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: statusAccion, json: async () => ({}) })
      .mockImplementationOnce((url: string) => {
        if (url.includes("/api/registro_habito/estadisticas?")) {
          return Promise.resolve({
            status: 200,
            json: async () => [{ habito_id: "h1", racha_actual: racha }],
          });
        }
        return Promise.resolve({ status: 200, json: async () => [] });
      });
  };

  const configurarEliminar = (status: number): void => {
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status,
      json: async () => ({}),
    });
  };

  it("muestra el indicador de carga mientras responde la API", () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    let arbol: ReactTestRenderer | undefined;

    act(() => {
      arbol = renderer.create(<DashboardScreen />);
    });

    arbolActual = arbol;
    expect(
      arbol?.root.findByProps({ testID: "loading-indicator" }),
    ).toBeTruthy();
  });

  it("carga hábitos y marca los registros activos de hoy", async () => {
    configurarFetch([{ habitoId: "h1", deleted_at: null }]);

    const arbol = await renderizar();
    const textos = textosDe(arbol);

    expect(textos).toContain("Beber agua");
    expect(textos).toContain("Hecho ✓");
    expect(textos).toContain("Marcar");

    const fecha = fechaLocalEsperada();
    const llamadas = (global.fetch as jest.Mock).mock.calls as [
      string,
      { headers: Record<string, string> },
    ][];
    const registro = llamadas.find(([url]) => url === urlDeRegistro(fecha));

    expect(registro).toBeDefined();
    expect(registro?.[1].headers).toEqual({
      Authorization: "Bearer mock-token",
    });
    expect(useFocusEffect).toHaveBeenCalled();
  });

  it("ignora registros borrados lógicamente en el GET", async () => {
    configurarFetch([
      { habitoId: "h1", deleted_at: "2026-11-20T10:00:00.000Z" },
    ]);

    const arbol = await renderizar();
    const textos = textosDe(arbol);

    expect(textos).not.toContain("Hecho ✓");
    expect(textos.filter((texto) => texto === "Marcar")).toHaveLength(2);
  });

  it("marca el hábito con PUT y cantidad de la meta", async () => {
    configurarFetch([]);
    const arbol = await renderizar();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 201,
      json: async () => ({}),
    });

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    const [url, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(
      `${API_BASE}/api/registro_habito/h1/${fechaLocalEsperada()}`,
    );
    expect(opciones.method).toBe("PUT");
    expect(opciones.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer mock-token",
    });
    expect(JSON.parse(opciones.body)).toStrictEqual({ cantidad: 2 });
    expect(textosDe(arbol)).toContain("Hecho ✓");
  });

  it("desmarca el hábito con DELETE", async () => {
    configurarFetch([{ habitoId: "h1" }]);
    const arbol = await renderizar();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 204,
      json: async () => ({}),
    });

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    const [url, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { method: string; body?: string },
    ];
    expect(url).toBe(
      `${API_BASE}/api/registro_habito/h1/${fechaLocalEsperada()}`,
    );
    expect(opciones.method).toBe("DELETE");
    expect(opciones.body).toBeUndefined();
    expect(textosDe(arbol)).toContain("Marcar");
    expect(textosDe(arbol)).not.toContain("Hecho ✓");
  });

  it("revierte el cambio y avisa si la API falla sin filtrar el token", async () => {
    configurarFetch([]);
    const arbol = await renderizar();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 500,
      json: async () => ({}),
    });

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    const textos = textosDe(arbol);
    expect(textos).toContain("Marcar");
    expect(textos).not.toContain("Hecho ✓");
    expect(textos).toContain("No se pudo actualizar el registro");
    expect(textos.join(" ")).not.toContain("mock-token");
  });

  it("no bloquea el listado si falla la carga de registros", async () => {
    configurarFetch([], 500);

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Beber agua");
    expect(textosDe(arbol)).toContain("Marcar");
  });

  it("usa racha_actual por habito_id desde el array de estadísticas", async () => {
    configurarFetch([], 200, [
      { habito_id: "h2", racha_actual: 11 },
      { habito_id: "h1", racha_actual: 7 },
    ]);

    const arbol = await renderizar();
    const textos = textosDe(arbol);

    expect(textos).toContain("Racha: 7");
    expect(textos).toContain("Racha: 11");
    expect(arbol.root.findByProps({ testID: "racha-h1" })).toBeTruthy();

    const llamadas = (global.fetch as jest.Mock).mock.calls as [
      string,
      { headers: Record<string, string> },
    ][];
    const estadisticas = llamadas.find(
      ([url]) => url === urlDeEstadisticas(fechaLocalEsperada()),
    );

    expect(estadisticas?.[1].headers).toEqual({
      Authorization: "Bearer mock-token",
    });
  });

  it("lee estadísticas desde el contenedor estadisticas", async () => {
    configurarFetch([], 200, {
      estadisticas: [{ habito_id: "h1", racha_actual: 8 }],
    });

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Racha: 8");
  });

  it("lee estadísticas desde el contenedor rachas", async () => {
    configurarFetch([], 200, {
      rachas: [{ habito_id: "h2", racha_actual: 12 }],
    });

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Racha: 12");
  });

  it("usa rachaDe si falla el endpoint de estadísticas", async () => {
    configurarFetch([], 200, [], 500);

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Racha: 5");
    expect(textosDe(arbol)).toContain("Racha: 10");
  });

  it("usa rachaDe si estadísticas no incluye un hábito", async () => {
    configurarFetch([], 200, [{ habito_id: "h1", racha_actual: 7 }]);

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Racha: 7");
    expect(textosDe(arbol)).toContain("Racha: 10");
  });

  it("recarga la racha tras marcar sin romper el estado optimista", async () => {
    configurarFetch([], 200, [{ habito_id: "h1", racha_actual: 5 }]);
    const arbol = await renderizar();
    configurarRecarga(6);

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    expect(textosDe(arbol)).toContain("Hecho ✓");
    expect(textosDe(arbol)).toContain("Racha: 6");
    const llamadas = (global.fetch as jest.Mock).mock.calls as [string][];
    expect(
      llamadas.filter(
        ([url]) => url === urlDeEstadisticas(fechaLocalEsperada()),
      ),
    ).toHaveLength(1);
  });

  it("recarga la racha tras desmarcar sin romper el estado optimista", async () => {
    configurarFetch([{ habitoId: "h1" }], 200, [
      { habito_id: "h1", racha_actual: 6 },
    ]);
    const arbol = await renderizar();
    configurarRecarga(5, 204);

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    expect(textosDe(arbol)).toContain("Marcar");
    expect(textosDe(arbol)).toContain("Racha: 5");
  });

  it("muestra acciones de editar y eliminar sin reemplazar marcar", async () => {
    configurarFetch([]);

    const arbol = await renderizar();

    expect(arbol.root.findByProps({ testID: "marcar-h1" })).toBeTruthy();
    expect(arbol.root.findByProps({ testID: "editar-h1" })).toBeTruthy();
    expect(arbol.root.findByProps({ testID: "eliminar-h1" })).toBeTruthy();
  });

  it("navega a editar con los parámetros del hábito", async () => {
    configurarFetch([]);
    const arbol = await renderizar();

    pulsar(arbol, "editar-h1");

    expect(pushMock).toHaveBeenCalledWith({
      pathname: "/habito/editar",
      params: {
        id: "h1",
        nombre: "Beber agua",
        meta: "2",
        tipo: "manual",
        activo: "true",
      },
    });
  });

  it("abre la confirmación y cancelar no elimina", async () => {
    configurarFetch([]);
    const arbol = await renderizar();

    pulsar(arbol, "eliminar-h1");

    expect(
      arbol.root.findByProps({ testID: "modal-confirmacion" }),
    ).toBeTruthy();
    expect(textosDe(arbol)).toContain("¿Eliminar Beber agua?");

    (global.fetch as jest.Mock).mockClear();
    pulsar(arbol, "cancelar-eliminar-h1");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(
      arbol.root.findAllByProps({ testID: "modal-confirmacion" }),
    ).toHaveLength(0);
  });

  it("elimina con DELETE y quita la tarjeta", async () => {
    configurarFetch([{ habitoId: "h1" }]);
    const arbol = await renderizar();
    configurarEliminar(204);

    pulsar(arbol, "eliminar-h1");
    pulsar(arbol, "confirmar-eliminar-h1");
    await esperarAccion();

    const [url, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body?: string },
    ];
    expect(url).toBe(`${API_BASE}/api/habito/h1`);
    expect(opciones.method).toBe("DELETE");
    expect(opciones.headers).toEqual({ Authorization: "Bearer mock-token" });
    expect(opciones.body).toBeUndefined();
    expect(textosDe(arbol)).not.toContain("Beber agua");
    expect(textosDe(arbol)).toContain("Leer");
  });

  it("restaura hábitos, registros y rachas si DELETE falla", async () => {
    configurarFetch([{ habitoId: "h1" }], 200, [
      { habito_id: "h1", racha_actual: 7 },
    ]);
    const arbol = await renderizar();
    configurarEliminar(500);

    pulsar(arbol, "eliminar-h1");
    pulsar(arbol, "confirmar-eliminar-h1");
    await esperarAccion();

    const textos = textosDe(arbol);
    expect(textos).toContain("Beber agua");
    expect(textos).toContain("Hecho ✓");
    expect(textos).toContain("Racha: 7");
    expect(textos).toContain("No se pudo eliminar el hábito");
    expect(textos.join(" ")).not.toContain("mock-token");
  });

  it("restaura el estado previo si la petición DELETE falla", async () => {
    configurarFetch([], 200, [{ habito_id: "h1", racha_actual: 7 }]);
    const arbol = await renderizar();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network"));

    pulsar(arbol, "eliminar-h1");
    pulsar(arbol, "confirmar-eliminar-h1");
    await esperarAccion();

    const textos = textosDe(arbol);
    expect(textos).toContain("Beber agua");
    expect(textos).toContain("Racha: 7");
    expect(textos).toContain("No se pudo eliminar el hábito");
    expect(textos.join(" ")).not.toContain("mock-token");
  });

  it("cierra sesión borrando el token y redirige a /login", async () => {
    configurarFetch([]);
    const arbol = await renderizar();

    const boton = arbol.root.findByProps({
      testID: "cerrar-sesion-button",
    });
    await act(async () => {
      await boton.props.onPress();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(textosDe(arbol).join(" ")).not.toContain("mock-token");
  });

  it("reserva espacio superior para el encabezado y cerrar sesión", async () => {
    configurarFetch([]);
    const arbol = await renderizar();

    const contenido = arbol.root.findByProps({
      testID: "dashboard-content",
    });
    const estilo = contenido.props.style as { paddingTop?: number };
    expect(estilo.paddingTop).toBeGreaterThanOrEqual(40);

    const estiloDe = (nodo: ReactTestInstance | null) => {
      if (!nodo) return null;
      const estilo: unknown = nodo.props.style;
      return typeof estilo === "object" && estilo !== null
        ? (estilo as { gap?: number })
        : null;
    };
    const boton = arbol.root.findByProps({ testID: "cerrar-sesion-button" });
    let cabecera: ReactTestInstance | null = boton.parent;
    while (cabecera && estiloDe(cabecera)?.gap === undefined) {
      cabecera = cabecera.parent;
    }
    expect(estiloDe(cabecera)?.gap).toBeGreaterThanOrEqual(12);
    expect(textosDe(arbol)).toContain("CONTROL DIARIO");
    expect(textosDe(arbol)).toContain("Cerrar sesión");
    expect(arbol.root.findAllByType(View).length).toBeGreaterThan(0);
  });

  it("guarda hábitos locales y sincroniza pendientes al cargar", async () => {
    configurarFetch([]);

    await renderizar();

    expect(guardarHabilidadesLocales).toHaveBeenCalledWith(HABITOS);
    expect(sincronizarCambios).toHaveBeenCalledTimes(1);
  });

  it("muestra hábitos guardados localmente si falla la conexión", async () => {
    (leerHabilidadesLocales as jest.Mock).mockResolvedValue([
      { id: "h1", nombre: "Beber agua", meta: 2 },
    ]);
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error("sin red")),
    );

    const arbol = await renderizar();

    expect(textosDe(arbol)).toContain("Beber agua");
    expect(textosDe(arbol)).not.toContain("Error de conexión");
  });

  it("encola y confirma el registro al marcar", async () => {
    configurarFetch([]);
    const arbol = await renderizar();
    (registrarCambioOffline as jest.Mock).mockClear();
    (confirmarCambioOffline as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 201,
      json: async () => ({}),
    });

    pulsar(arbol, "marcar-h1");
    await esperarAccion();

    expect(registrarCambioOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: "registro",
        operacion: "crear",
        datos: expect.objectContaining({
          habitoId: "h1",
          cantidad: 2,
          deleted: false,
        }),
      }),
    );
    expect(confirmarCambioOffline).toHaveBeenCalledWith("cambio-local");
  });

  it("encola y confirma la eliminación lógica del hábito", async () => {
    configurarFetch([]);
    const arbol = await renderizar();
    (registrarCambioOffline as jest.Mock).mockClear();
    (confirmarCambioOffline as jest.Mock).mockClear();
    configurarEliminar(204);

    pulsar(arbol, "eliminar-h1");
    pulsar(arbol, "confirmar-eliminar-h1");
    await esperarAccion();

    expect(registrarCambioOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: "habito",
        operacion: "eliminar",
        datos: expect.objectContaining({ id: "h1", deleted: true }),
      }),
    );
    expect(confirmarCambioOffline).toHaveBeenCalledWith("cambio-local");
  });
});
