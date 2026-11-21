import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import SemanaScreen, {
  diasDeSemana,
  fechaLocal,
  inicioDeSemana,
  rangoDeSemana,
  registrosDeRespuesta,
  resumenDeRegistros,
} from "../app/(tabs)/semana";
import DetalleHabitoScreen, {
  fechaLocal as fechaLocalDetalle,
} from "../app/habito/[id]";
import GestoAccesible from "../src/components/gesto-accesible";
import { registrarCambioOffline } from "../src/services/offline-sync";
import { useAcelerometro } from "../src/sensors/use-acelerometro";
import { usePedometro } from "../src/sensors/use-pedometro";

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Stack: () => React.createElement(Text, null, "stack"),
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(() => ({
      replace: jest.fn(),
      push: jest.fn(),
      back: jest.fn(),
    })),
    useFocusEffect: jest.fn((cb: () => void | Promise<void>) => {
      (globalThis as GlobalConFocus).mockFocusCallback = cb;
    }),
  };
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "mock-token"),
}));

jest.mock("../src/services/offline-sync", () => ({
  registrarCambioOffline: jest.fn(async () => ({
    id: "cambio-1",
    entidad: "registro",
    operacion: "crear",
    datos: {},
    updated_at: "2026-11-21T10:00:00.000Z",
  })),
}));

jest.mock("../src/sensors/use-pedometro", () => ({
  usePedometro: jest.fn(),
}));

jest.mock("../src/sensors/use-acelerometro", () => ({
  useAcelerometro: jest.fn(),
}));

global.fetch = jest.fn();

type EventosGestos = {
  toque: Array<() => void>;
  pulsacionLarga: Array<() => void>;
};

type GlobalConFocus = {
  mockFocusCallback?: () => void | Promise<void>;
};

const globalConFocus = globalThis as GlobalConFocus;

let arbolActual: ReactTestRenderer | undefined;

const eventos = (): EventosGestos =>
  (global as unknown as { __eventosGestos: EventosGestos }).__eventosGestos;

const textosDe = (arbol: ReactTestRenderer): unknown[] =>
  arbol.root.findAllByType(Text).map((nodo) => nodo.props.children);

const renderizarSemana = async (): Promise<ReactTestRenderer> => {
  let arbol: ReactTestRenderer | undefined;

  act(() => {
    arbol = renderer.create(<SemanaScreen />);
  });
  if (!arbol) throw new Error("No se pudo renderizar la semana");
  arbolActual = arbol;
  const ejecutarFocus = globalConFocus.mockFocusCallback;
  if (!ejecutarFocus) throw new Error("No se registró el foco de la semana");
  await act(async () => {
    await ejecutarFocus();
  });
  return arbol;
};

const renderizarDetalle = async (): Promise<ReactTestRenderer> => {
  let arbol: ReactTestRenderer | undefined;

  act(() => {
    arbol = renderer.create(<DetalleHabitoScreen />);
  });
  if (!arbol) throw new Error("No se pudo renderizar el detalle");
  arbolActual = arbol;
  const ejecutarFocus = globalConFocus.mockFocusCallback;
  if (!ejecutarFocus) throw new Error("No se registró el foco del detalle");
  await act(async () => {
    await ejecutarFocus();
  });
  return arbol;
};

const esperarAccion = async (): Promise<void> => {
  for (let intento = 0; intento < 3; intento += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const configurarFetchSemana = (registros: unknown[]): void => {
  (global.fetch as jest.Mock).mockImplementation(() =>
    Promise.resolve({
      status: 200,
      json: async () => ({ registros }),
    }),
  );
};

const configurarFetchDetalle = (datos: unknown): void => {
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 200,
    json: async () => datos,
  });
};

describe("rutas, gestos y accesibilidad", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalConFocus.mockFocusCallback = undefined;
    arbolActual = undefined;
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "h1",
      nombre: "Beber agua",
    });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("mock-token");
    (usePedometro as jest.Mock).mockReturnValue({
      estado: "activo",
      pasos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual: jest.fn(),
      detener: jest.fn(),
    });
    (useAcelerometro as jest.Mock).mockReturnValue({
      estado: "sin-iniciar",
      segundos: 0,
      movimientos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual: jest.fn(),
      detener: jest.fn(),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ racha: 3, registros: [{ fecha: "2026-11-21" }] }),
    });
  });

  afterEach(() => {
    act(() => arbolActual?.unmount());
  });

  it("envuelve el layout raíz en GestureHandlerRootView", () => {
    const codigo = readFileSync(join(__dirname, "../app/_layout.tsx"), "utf8");

    expect(codigo).toContain("GestureHandlerRootView");
    expect(codigo).toContain("Stack");
  });

  it("ofrece botón accesible como alternativa al gesto", () => {
    const alternativa = jest.fn();
    let arbol: ReactTestRenderer | undefined;

    act(() => {
      arbol = renderer.create(
        <GestoAccesible
          etiqueta="Marcar hábito"
          testID="gesto-marcar"
          onAlternativa={alternativa}
        >
          <Text>Marcar</Text>
        </GestoAccesible>,
      );
    });
    if (!arbol) throw new Error("No se pudo renderizar el gesto");

    act(() => {
      arbol!.root
        .findByProps({ accessibilityLabel: "Marcar hábito" })
        .props.onPress();
    });

    expect(alternativa).toHaveBeenCalledTimes(1);
    expect(eventos().toque).toHaveLength(1);
    expect(eventos().pulsacionLarga).toHaveLength(1);
  });

  it("cambia de semana con botones accesibles y pulsación larga", async () => {
    const arbol = await renderizarSemana();

    expect(textosDe(arbol)).toContain("Semana 1");

    act(() => {
      arbol.root
        .findByProps({ testID: "semana-siguiente-button" })
        .props.onPress();
    });

    expect(textosDe(arbol)).toContain("Semana 2");

    const pulsacion = eventos().pulsacionLarga[0];
    act(() => {
      pulsacion();
    });

    expect(textosDe(arbol)).toContain("Semana 3");
  });

  it("muestra historial y estadísticas legibles del hábito", async () => {
    const arbol = await renderizarDetalle();

    expect(textosDe(arbol)).toContain("HISTORIAL Y ESTADÍSTICAS");
    expect(textosDe(arbol)).toContain("Beber agua");
    expect(textosDe(arbol)).toContain("Racha actual: 3");
    expect(textosDe(arbol)).not.toContain("Hábito: h1");
    expect(
      arbol.root
        .findAllByType(TouchableOpacity)
        .some((nodo) =>
          String(nodo.props.accessibilityLabel ?? "").includes("Manual"),
        ),
    ).toBe(true);
  });

  it("muestra mejor racha, progreso y registros recientes", async () => {
    const hoy = fechaLocalDetalle();
    configurarFetchDetalle({
      nombre: "Beber agua",
      racha_actual: 3,
      mejor_racha: 9,
      meta: 2,
      registros: [
        { fecha: hoy, cantidad: 1 },
        { fecha: "2026-11-20", cantidad: 2 },
        {
          fecha: "2026-11-19",
          cantidad: 2,
          deleted_at: "2026-11-19T10:00:00Z",
        },
      ],
    });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "h1" });

    const arbol = await renderizarDetalle();

    expect(textosDe(arbol)).toContain("Beber agua");
    expect(textosDe(arbol)).toContain("Mejor racha: 9");
    expect(textosDe(arbol)).toContain("Progreso: 50%");
    expect(textosDe(arbol)).toContain("Estado: En progreso");
    expect(textosDe(arbol)).toContain(`${hoy} · 1`);
    expect(textosDe(arbol)).not.toContain("2026-11-19");
  });

  it("calcula fechas, registros activos y cumplimiento semanal", () => {
    const fechas = diasDeSemana(new Date(2026, 10, 16), 1);
    expect(fechas).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);

    const registros = registrosDeRespuesta(
      {
        registros: [
          { fecha: fechas[0], cantidad: 2 },
          { fecha: fechas[1], cantidad: 1, deleted_at: "2026-11-17T10:00:00Z" },
        ],
      },
      fechas[2],
    );
    expect(registros).toHaveLength(1);
    expect(registros[0].fecha).toBe(fechas[0]);

    const resumen = resumenDeRegistros(fechas, registros);
    expect(resumen.dias[0].cumplido).toBe(true);
    expect(resumen.dias[1].cumplido).toBe(false);
    expect(resumen.porcentaje).toBe(14);
  });

  it("muestra el cumplimiento semanal con días reales", async () => {
    const fechas = diasDeSemana(inicioDeSemana(), 1);
    configurarFetchSemana([
      { fecha: fechas[0], cantidad: 1 },
      { fecha: fechas[2], cantidad: 2 },
    ]);

    const arbol = await renderizarSemana();

    expect(textosDe(arbol)).toContain("Cumplimiento semanal: 29%");
    expect(textosDe(arbol)).toContain(fechas[0]);
    expect(textosDe(arbol)).toContain(fechas[2]);
    expect(
      arbol.root.findByProps({ testID: `semana-dia-${fechas[0]}` }),
    ).toBeTruthy();
  });

  it("explica el contador diario en la vista semanal", async () => {
    const arbol = await renderizarSemana();
    const nodos = arbol.root.findAll(() => true);
    const leyenda = arbol.root.findAll(
      (nodo) => nodo.props.children === "Contador: hábitos completados por día",
    )[0];
    if (!leyenda) throw new Error("No se encontró la leyenda del contador");

    const resumen = arbol.root.findByProps({ testID: "semana-resumen" });
    const dias = arbol.root.findByProps({ testID: "semana-dias" });
    expect(nodos.indexOf(leyenda)).toBeGreaterThan(nodos.indexOf(resumen));
    expect(nodos.indexOf(leyenda)).toBeLessThan(nodos.indexOf(dias));
    expect(arbol.root.findByProps({ testID: "semana-gesto" })).toBeTruthy();
  });

  it("ubica la pista de pulsación larga al pie de la semana", async () => {
    const arbol = await renderizarSemana();
    const nodos = arbol.root.findAll(() => true);
    const pista = arbol.root.findAll(
      (nodo) => nodo.props.children === "Mantén presionado para avanzar",
    )[0];
    if (!pista) throw new Error("No se encontró la pista de la semana");

    const resumen = arbol.root.findByProps({ testID: "semana-resumen" });
    const hoy = arbol.root.findByProps({ testID: "semana-hoy-button" });
    const gesto = arbol.root.findByProps({ testID: "semana-gesto" });

    expect(nodos.indexOf(pista)).toBeGreaterThan(nodos.indexOf(resumen));
    expect(nodos.indexOf(pista)).toBeGreaterThan(nodos.indexOf(hoy));
    expect(
      (pista.props.style as { fontSize?: number }).fontSize,
    ).toBeLessThanOrEqual(14);
    expect(gesto.props.etiqueta).toBe("Avanzar semana con pulsación larga");
  });

  it("no mezcla sensores ni cronómetro en la vista semanal", async () => {
    const arbol = await renderizarSemana();

    expect(textosDe(arbol)).not.toContain("Acelerómetro: sin-iniciar");
    expect(
      arbol.root.findAllByProps({ testID: "cronometro-manual-button" }),
    ).toHaveLength(0);
    expect(
      arbol.root.findAllByProps({ testID: "cronometro-acelerometro-button" }),
    ).toHaveLength(0);
  });

  it("registra pasos manualmente en la cola offline", async () => {
    const arbol = await renderizarDetalle();

    act(() => {
      arbol.root.findByProps({ testID: "manual-pasos-button" }).props.onPress();
    });
    await esperarAccion();

    expect(registrarCambioOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: "registro",
        operacion: "crear",
        datos: expect.objectContaining({
          habitoId: "h1",
          cantidad: 1000,
          remote_id: "h1",
        }),
      }),
    );
    expect(textosDe(arbol)).toContain("Pasos registrados: 1000");
  });

  it("muestra una sola vez el texto de pasos registrados", async () => {
    const arbol = await renderizarDetalle();

    act(() => {
      arbol.root.findByProps({ testID: "manual-pasos-button" }).props.onPress();
    });
    await esperarAccion();

    const pasosRegistrados = textosDe(arbol).filter((texto) =>
      String(texto).includes("Pasos registrados:"),
    );
    expect(pasosRegistrados).toEqual(["Pasos registrados: 1000"]);
  });

  it("aclara las herramientas de registro sin mover estadísticas ni registros", async () => {
    const arbol = await renderizarDetalle();
    const textos = textosDe(arbol);
    expect(textos).toContain("Registra pasos en este hábito");
    expect(textos).toContain("Registra tiempo o movimiento en este hábito");

    const nodos = arbol.root.findAll(() => true);
    const estadisticas = arbol.root.findByProps({
      testID: "detalle-estadisticas",
    });
    const registros = arbol.root.findByProps({ testID: "detalle-registros" });
    const sensores = arbol.root.findByProps({ testID: "detalle-sensores" });
    expect(nodos.indexOf(estadisticas)).toBeLessThan(nodos.indexOf(registros));
    expect(nodos.indexOf(registros)).toBeLessThan(nodos.indexOf(sensores));
    expect(
      arbol.root.findByProps({ testID: "cronometro-manual-button" }).props
        .accessibilityLabel,
    ).toBe("Cronómetro manual");
  });

  it("ofrece un placeholder claro en la entrada manual de pasos", async () => {
    const arbol = await renderizarDetalle();

    const entrada = arbol.root.findByProps({
      testID: "pasos-manuales-input",
    });
    expect(entrada.props.placeholder).toBe("Ej. 1000");
    expect(entrada.props.accessibilityLabel).toBe("Cantidad de pasos manuales");
  });

  it("explica la alternativa manual si el podómetro no está disponible", async () => {
    (usePedometro as jest.Mock).mockReturnValue({
      estado: "no-disponible",
      pasos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual: jest.fn(),
      detener: jest.fn(),
    });

    const arbol = await renderizarDetalle();

    expect(textosDe(arbol)).toContain(
      "Podómetro no disponible; usa entrada manual",
    );
    expect(
      arbol.root.findByProps({ testID: "manual-pasos-button" }).props
        .accessibilityLabel,
    ).toBe("Manual de pasos");
  });

  it("calcula el rango real de la semana desde el inicio local", () => {
    expect(fechaLocal(new Date(2026, 10, 16))).toBe("2026-11-16");
    expect(inicioDeSemana(new Date(2026, 10, 18, 15))).toEqual(
      new Date(2026, 10, 16),
    );
    expect(rangoDeSemana(new Date(2026, 10, 16), 1)).toBe(
      "2026-11-16 — 2026-11-22",
    );
    expect(rangoDeSemana(new Date(2026, 10, 16), 2)).toBe(
      "2026-11-23 — 2026-11-29",
    );
  });

  it("muestra el rango real y vuelve a la semana base con Hoy", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn(), push });
    const arbol = await renderizarSemana();

    const inicio = inicioDeSemana();
    expect(textosDe(arbol)).toContain(rangoDeSemana(inicio, 1));

    act(() => {
      arbol.root
        .findByProps({ testID: "semana-siguiente-button" })
        .props.onPress();
    });
    expect(textosDe(arbol)).toContain(rangoDeSemana(inicio, 2));

    act(() => {
      arbol.root.findByProps({ testID: "semana-hoy-button" }).props.onPress();
    });

    expect(textosDe(arbol)).toContain("Semana 1");
    expect(textosDe(arbol)).toContain(rangoDeSemana(inicio, 1));
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("usa entrada numérica válida para los pasos manuales", async () => {
    const arbol = await renderizarDetalle();

    act(() => {
      arbol.root
        .findByProps({ testID: "pasos-manuales-input" })
        .props.onChangeText("2500");
    });
    act(() => {
      arbol.root.findByProps({ testID: "manual-pasos-button" }).props.onPress();
    });
    await esperarAccion();

    expect(registrarCambioOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        datos: expect.objectContaining({ cantidad: 2500 }),
      }),
    );
    expect(textosDe(arbol)).toContain("Pasos registrados: 2500");
  });

  it("rechaza una entrada de pasos menor a uno", async () => {
    const arbol = await renderizarDetalle();

    act(() => {
      arbol.root
        .findByProps({ testID: "pasos-manuales-input" })
        .props.onChangeText("0");
    });
    act(() => {
      arbol.root.findByProps({ testID: "manual-pasos-button" }).props.onPress();
    });
    await esperarAccion();

    expect(registrarCambioOffline).not.toHaveBeenCalled();
    expect(textosDe(arbol)).toContain("Ingresa un número de pasos ≥ 1");
  });

  it("acumula pasos manuales en pulsaciones sucesivas", async () => {
    const registrarManual = jest.fn();
    (usePedometro as jest.Mock).mockReturnValue({
      estado: "activo",
      pasos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual,
      detener: jest.fn(),
    });

    const arbol = await renderizarDetalle();
    const boton = () =>
      arbol.root.findByProps({ testID: "manual-pasos-button" });
    act(() => boton().props.onPress());
    await esperarAccion();
    act(() => boton().props.onPress());
    await esperarAccion();

    expect(registrarManual).toHaveBeenNthCalledWith(1, 1000);
    expect(registrarManual).toHaveBeenNthCalledWith(2, 2000);
    expect(textosDe(arbol)).toContain("Pasos registrados: 2000");
  });

  it("acumula el cronómetro manual en el detalle e inicia el sensor", async () => {
    const registrarManual = jest.fn();
    const iniciar = jest.fn(async () => undefined);
    (useAcelerometro as jest.Mock).mockReturnValue({
      estado: "activo",
      segundos: 0,
      movimientos: 0,
      iniciar,
      registrarManual,
      detener: jest.fn(),
    });

    const arbol = await renderizarDetalle();
    const boton = () =>
      arbol.root.findByProps({ testID: "cronometro-manual-button" });
    act(() => boton().props.onPress());
    act(() => boton().props.onPress());
    act(() => {
      arbol.root
        .findByProps({ testID: "cronometro-acelerometro-button" })
        .props.onPress();
    });

    expect(registrarManual).toHaveBeenNthCalledWith(1, 60);
    expect(registrarManual).toHaveBeenNthCalledWith(2, 120);
    expect(textosDe(arbol)).toContain("Cronómetro manual: 120 s");
    expect(iniciar).toHaveBeenCalledTimes(1);
  });
});
