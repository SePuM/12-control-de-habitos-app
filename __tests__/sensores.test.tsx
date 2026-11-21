import React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import * as Sensors from "expo-sensors";

import { observarAceleracion } from "../src/sensors/acelerometro";
import { observarPasos } from "../src/sensors/pedometro";
import {
  crearSuscripcion,
  gestosConBoton,
  liberarSuscripcion,
  verificarDisponibilidad,
  vibrarSiDisponible,
} from "../src/sensors/seguridad";
import { useAcelerometro } from "../src/sensors/use-acelerometro";
import { usePedometro } from "../src/sensors/use-pedometro";

jest.mock("expo-sensors", () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    watchStepCount: jest.fn(),
  },
  Accelerometer: {
    isAvailableAsync: jest.fn(),
    addListener: jest.fn(),
  },
}));

jest.mock("expo-haptics", () => ({
  isAvailableAsync: jest.fn(),
  impactAsync: jest.fn(),
}));

const PedometerMock = Sensors.Pedometer as unknown as {
  isAvailableAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  watchStepCount: jest.Mock;
};

const AccelerometerMock = Sensors.Accelerometer as unknown as {
  isAvailableAsync: jest.Mock;
  addListener: jest.Mock;
};

const HapticsMock = Haptics as unknown as {
  isAvailableAsync: jest.Mock;
  impactAsync: jest.Mock;
};

function PedometroHarness() {
  const { detener, estado, iniciar, pasos, registrarManual } = usePedometro();

  return (
    <React.Fragment>
      <Text>{estado}</Text>
      <Text>{pasos}</Text>
      <TouchableOpacity
        testID="iniciar-pedometro"
        onPress={() => void iniciar()}
      />
      <TouchableOpacity
        testID="manual-pedometro"
        onPress={() => registrarManual(42)}
      />
      <TouchableOpacity testID="detener-pedometro" onPress={detener} />
    </React.Fragment>
  );
}

function AcelerometroHarness() {
  const { detener, estado, iniciar, movimientos, registrarManual, segundos } =
    useAcelerometro();

  return (
    <React.Fragment>
      <Text>{estado}</Text>
      <Text>{segundos}</Text>
      <Text>{movimientos}</Text>
      <TouchableOpacity
        testID="iniciar-acelerometro"
        onPress={() => void iniciar()}
      />
      <TouchableOpacity
        testID="manual-acelerometro"
        onPress={() => registrarManual(9)}
      />
      <TouchableOpacity testID="detener-acelerometro" onPress={detener} />
    </React.Fragment>
  );
}

describe("sensores y gestos accesibles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PedometerMock.isAvailableAsync.mockResolvedValue(true);
    PedometerMock.requestPermissionsAsync.mockResolvedValue({ granted: true });
    PedometerMock.watchStepCount.mockReturnValue({ remove: jest.fn() });
    AccelerometerMock.isAvailableAsync.mockResolvedValue(true);
    AccelerometerMock.addListener.mockReturnValue({ remove: jest.fn() });
    HapticsMock.isAvailableAsync.mockResolvedValue(true);
    HapticsMock.impactAsync.mockResolvedValue(undefined);
  });

  it("devuelve true si el sensor está disponible", async () => {
    const sensor = { isAvailableAsync: jest.fn(async () => true) };

    await expect(verificarDisponibilidad(sensor)).resolves.toBe(true);
  });

  it("devuelve false si isAvailableAsync falla", async () => {
    const sensor = {
      isAvailableAsync: jest.fn(async () => {
        throw new Error("sensor no disponible");
      }),
    };

    await expect(verificarDisponibilidad(sensor)).resolves.toBe(false);
  });

  it("crea y libera una suscripción con remove", () => {
    const remove = jest.fn();
    const suscripcion = crearSuscripcion(true, () => ({ remove }));

    liberarSuscripcion(suscripcion);

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("no crea suscripción si el sensor no está disponible", () => {
    const observar = jest.fn(() => ({ remove: jest.fn() }));

    expect(crearSuscripcion(false, observar)).toBeNull();
    expect(observar).not.toHaveBeenCalled();
  });

  it("vibra solo si expo-haptics confirma disponibilidad", async () => {
    HapticsMock.isAvailableAsync.mockResolvedValueOnce(false);
    await vibrarSiDisponible(HapticsMock);
    expect(HapticsMock.impactAsync).not.toHaveBeenCalled();

    await vibrarSiDisponible(HapticsMock);
    expect(HapticsMock.impactAsync).toHaveBeenCalledTimes(1);
  });

  it("no rompe si la disponibilidad o la vibración fallan", async () => {
    HapticsMock.isAvailableAsync.mockRejectedValueOnce(
      new Error("sin haptics"),
    );

    await expect(vibrarSiDisponible(HapticsMock)).resolves.toBeUndefined();

    HapticsMock.impactAsync.mockRejectedValueOnce(new Error("fallo"));

    await expect(vibrarSiDisponible(HapticsMock)).resolves.toBeUndefined();
  });

  it("ofrece botón accesible como alternativa al gesto", () => {
    const accion = jest.fn();
    const gesto = gestosConBoton(accion, "Marcar");

    expect(gesto.accessible).toBe(true);
    expect(gesto.accessibilityLabel).toBe("Marcar");
    expect(gesto.accessibilityRole).toBe("button");
    gesto.onPress();
    gesto.onResponderRelease();

    expect(accion).toHaveBeenCalledTimes(2);
  });

  it("observa pasos y libera la suscripción al detener", async () => {
    const alCambiar = jest.fn();
    const remove = jest.fn();
    PedometerMock.watchStepCount.mockReturnValue({ remove });
    const control = await observarPasos(alCambiar);

    const observador = PedometerMock.watchStepCount.mock.calls[0][0];
    observador({ steps: 12 });
    control.detener();

    expect(alCambiar).toHaveBeenCalledWith(12);
    expect(PedometerMock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("no observa pasos si no hay permiso", async () => {
    PedometerMock.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await observarPasos(jest.fn());

    expect(PedometerMock.watchStepCount).not.toHaveBeenCalled();
  });

  it("limpia el pedómetro al desmontar y admite entrada manual", async () => {
    const remove = jest.fn();
    PedometerMock.watchStepCount.mockReturnValue({ remove });
    let arbol: ReactTestRenderer | undefined;

    await act(async () => {
      arbol = renderer.create(<PedometroHarness />);
    });
    if (!arbol) throw new Error("No se pudo renderizar el pedómetro");

    await act(async () => {
      arbol!.root.findByProps({ testID: "iniciar-pedometro" }).props.onPress();
    });
    act(() => {
      arbol!.root.findByProps({ testID: "manual-pedometro" }).props.onPress();
    });

    expect(arbol.root.findAllByType(Text)[1].props.children).toBe(42);

    act(() => {
      arbol!.unmount();
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("observa aceleración y admite cronómetro manual", async () => {
    const alCambiar = jest.fn();
    const remove = jest.fn();
    AccelerometerMock.addListener.mockReturnValue({ remove });
    const control = await observarAceleracion(alCambiar);

    AccelerometerMock.addListener.mock.calls[0][0]({ x: 1, y: 2, z: 3 });
    control.detener();

    expect(alCambiar).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("usa el cronómetro manual cuando el acelerómetro no está disponible", async () => {
    AccelerometerMock.isAvailableAsync.mockResolvedValue(false);
    let arbol: ReactTestRenderer | undefined;

    await act(async () => {
      arbol = renderer.create(<AcelerometroHarness />);
    });
    if (!arbol) throw new Error("No se pudo renderizar el acelerómetro");

    act(() => {
      arbol!.root
        .findByProps({ testID: "manual-acelerometro" })
        .props.onPress();
    });

    expect(arbol.root.findAllByType(Text)[0].props.children).toBe(
      "no-disponible",
    );
    expect(arbol.root.findAllByType(Text)[1].props.children).toBe(9);
  });

  it("acumula segundos con temporizador y eventos del acelerómetro", async () => {
    jest.useFakeTimers();
    const remove = jest.fn();
    AccelerometerMock.addListener.mockReturnValue({ remove });
    let arbol: ReactTestRenderer | undefined;

    await act(async () => {
      arbol = renderer.create(<AcelerometroHarness />);
    });
    if (!arbol) throw new Error("No se pudo renderizar el acelerómetro");

    const manual = arbol.root.findByProps({ testID: "manual-acelerometro" });
    act(() => manual.props.onPress());
    act(() => manual.props.onPress());
    expect(arbol.root.findAllByType(Text)[1].props.children).toBe(18);

    await act(async () => {
      arbol!.root
        .findByProps({ testID: "iniciar-acelerometro" })
        .props.onPress();
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(arbol.root.findAllByType(Text)[1].props.children).toBe(19);

    const escucha = AccelerometerMock.addListener.mock.calls[0][0];
    act(() => escucha({ x: 1, y: 1, z: 1 }));
    expect(arbol.root.findAllByType(Text)[2].props.children).toBe(1);

    act(() => {
      arbol!.root
        .findByProps({ testID: "detener-acelerometro" })
        .props.onPress();
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(arbol.root.findAllByType(Text)[1].props.children).toBe(19);
    expect(remove).toHaveBeenCalledTimes(1);

    act(() => arbol!.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
