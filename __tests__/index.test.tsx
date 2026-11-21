import React from "react";
import renderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import LoadingScreen from "../app/(tabs)/index";
import { usePedometro } from "../src/sensors/use-pedometro";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

jest.mock("../src/sensors/use-pedometro", () => ({
  usePedometro: jest.fn(),
}));

describe("LoadingScreen (index.tsx)", () => {
  let replace: jest.Mock;
  let push: jest.Mock;

  const crear = async (): Promise<ReactTestRenderer> => {
    let pantalla: ReactTestRenderer | undefined;

    await act(async () => {
      pantalla = renderer.create(<LoadingScreen />);
    });
    if (!pantalla) throw new Error("No se pudo renderizar el inicio");
    await act(async () => {
      await Promise.resolve();
    });
    return pantalla;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    replace = jest.fn();
    push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace, push });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("token-local");
    (usePedometro as jest.Mock).mockReturnValue({
      estado: "sin-iniciar",
      pasos: 0,
      iniciar: jest.fn(async () => undefined),
      registrarManual: jest.fn(),
      detener: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("renders correctly", async () => {
    const pantalla = await crear();

    expect(pantalla.toJSON()).toMatchSnapshot();
    act(() => pantalla.unmount());
  });

  it("ofrece acceso accesible a los hábitos", async () => {
    const pantalla = await crear();

    act(() => {
      pantalla.root
        .findByProps({ testID: "ir-habitos-button" })
        .props.onPress();
    });

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(
      pantalla.root.findByProps({ testID: "ir-habitos-button" }).props
        .accessibilityLabel,
    ).toBe("Ir a mis hábitos");
    act(() => pantalla.unmount());
  });

  it("redirige al dashboard si existe token", async () => {
    const pantalla = await crear();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("token");
    expect(replace).toHaveBeenCalledWith("/dashboard");
    act(() => pantalla.unmount());
  });

  it("redirige a login si no existe token", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const pantalla = await crear();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(replace).toHaveBeenCalledWith("/login");
    act(() => pantalla.unmount());
  });

  it("no redirige si se desmonta antes de resolver la sesión", async () => {
    let pantalla: ReactTestRenderer | undefined;

    await act(async () => {
      pantalla = renderer.create(<LoadingScreen />);
    });
    if (!pantalla) throw new Error("No se pudo renderizar el inicio");

    act(() => pantalla!.unmount());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(replace).not.toHaveBeenCalled();
  });
});
