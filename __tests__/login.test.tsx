import React from "react";
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Alert, Text, TextInput, TouchableOpacity } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";

import LoginScreen from "../app/login";
import { API_BASE } from "../src/api/config";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

global.fetch = jest.fn();

type DatosRegistro = {
  nombre?: string;
  email?: string;
  password?: string;
};

const respuesta = (status: number, datos: Record<string, unknown>) => ({
  status,
  json: async () => datos,
});

const textosDe = (arbol: ReactTestRenderer): unknown[] =>
  arbol.root.findAllByType(Text).map((nodo) => nodo.props.children);

const inputsDe = (
  arbol: ReactTestRenderer,
  testID: string,
): ReactTestInstance[] =>
  arbol.root
    .findAllByType(TextInput)
    .filter((nodo) => nodo.props.testID === testID);

const cambiarTexto = (
  arbol: ReactTestRenderer,
  placeholder: string,
  valor: string,
): void => {
  const input = arbol.root
    .findAllByType(TextInput)
    .find((nodo) => nodo.props.placeholder === placeholder);

  if (!input) {
    throw new Error(`No se encontró el input ${placeholder}`);
  }

  act(() => {
    input.props.onChangeText(valor);
  });
};

const pulsarIngresar = async (arbol: ReactTestRenderer): Promise<void> => {
  const boton = arbol.root.findAllByType(TouchableOpacity)[0];

  if (!boton) {
    throw new Error("No se encontró el botón Ingresar");
  }

  await act(async () => {
    await boton.props.onPress();
  });
};

const renderizarLogin = (): ReactTestRenderer => {
  let arbol: ReactTestRenderer | undefined;

  act(() => {
    arbol = renderer.create(<LoginScreen />);
  });

  if (!arbol) {
    throw new Error("No se pudo renderizar el Login");
  }

  return arbol;
};

const pulsarBoton = async (
  arbol: ReactTestRenderer,
  testID: string,
): Promise<void> => {
  const boton = arbol.root.findByProps({ testID });

  await act(async () => {
    await boton.props.onPress();
  });
};

const alternarARegistro = (arbol: ReactTestRenderer): void => {
  act(() => {
    arbol.root.findByProps({ testID: "cambiar-modo-button" }).props.onPress();
  });
};

const completarRegistro = (
  arbol: ReactTestRenderer,
  datos: DatosRegistro = {},
): void => {
  cambiarTexto(arbol, "Nombre", datos.nombre ?? "Nuevo Usuario");
  cambiarTexto(arbol, "Correo electrónico", datos.email ?? "nuevo@test.com");
  cambiarTexto(arbol, "Contraseña", datos.password ?? "password123");
};

describe("LoginScreen (login.tsx)", () => {
  let replace: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    replace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("handles login success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta(200, { token: "mock-token" }),
    );
    const arbol = renderizarLogin();

    cambiarTexto(arbol, "Correo electrónico", "test@test.com");
    cambiarTexto(arbol, "Contraseña", "password");
    await pulsarIngresar(arbol);

    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "password" }),
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "token",
      "mock-token",
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("handles login failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta(401, { message: "Invalid credentials" }),
    );
    const arbol = renderizarLogin();

    cambiarTexto(arbol, "Correo electrónico", "test@test.com");
    cambiarTexto(arbol, "Contraseña", "wrong");
    await pulsarIngresar(arbol);

    expect(textosDe(arbol)).toContain("Invalid credentials");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("alterna al formulario de registro y muestra el campo nombre", () => {
    const arbol = renderizarLogin();

    expect(textosDe(arbol)).toContain("Crear cuenta / Registrarse");
    expect(inputsDe(arbol, "nombre-input")).toHaveLength(0);

    alternarARegistro(arbol);

    expect(textosDe(arbol)).toContain("Crear Cuenta");
    expect(textosDe(arbol)).toContain("Volver a iniciar sesión");
    expect(inputsDe(arbol, "nombre-input")).toHaveLength(1);
  });

  it("registra con 201, hace login automático y navega al dashboard", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        respuesta(201, {
          uid: "uid-1",
          email: "nuevo@test.com",
          nombre: "Nuevo Usuario",
        }),
      )
      .mockResolvedValueOnce(
        respuesta(200, {
          token: "token-login",
          refreshToken: "refresh-login",
        }),
      );
    const arbol = renderizarLogin();

    alternarARegistro(arbol);
    completarRegistro(arbol);
    await pulsarBoton(arbol, "auth-submit-button");

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/api/auth/registro`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "Nuevo Usuario",
          email: "nuevo@test.com",
          password: "password123",
        }),
      },
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${API_BASE}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nuevo@test.com",
          password: "password123",
        }),
      },
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "token",
      "token-login",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refreshToken",
      "refresh-login",
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it.each([400, 409, 500])(
    "muestra data.error si el registro falla con %i",
    async (status) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        respuesta(status, { error: "Correo ya registrado" }),
      );
      const arbol = renderizarLogin();

      alternarARegistro(arbol);
      completarRegistro(arbol);
      await pulsarBoton(arbol, "auth-submit-button");

      expect(textosDe(arbol)).toContain("Correo ya registrado");
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("muestra el primer detalle cuando error es Datos inválidos", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta(400, {
        error: "Datos inválidos",
        detalles: [
          { mensaje: "Correo inválido" },
          { mensaje: "Contraseña inválida" },
        ],
      }),
    );
    const arbol = renderizarLogin();

    alternarARegistro(arbol);
    completarRegistro(arbol);
    await pulsarBoton(arbol, "auth-submit-button");

    expect(textosDe(arbol)).toContain("Correo inválido");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("cae al fallback de registro si la API no envía mensaje", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta(500, {}));
    const arbol = renderizarLogin();

    alternarARegistro(arbol);
    completarRegistro(arbol);
    await pulsarBoton(arbol, "auth-submit-button");

    expect(textosDe(arbol)).toContain("Error al crear cuenta");
  });

  it.each(["", "a".repeat(81)])(
    "rechaza nombres de registro fuera de 1 a 80 caracteres",
    async (nombre) => {
      const arbol = renderizarLogin();

      alternarARegistro(arbol);
      completarRegistro(arbol, { nombre });
      await pulsarBoton(arbol, "auth-submit-button");

      expect(textosDe(arbol)).toContain(
        "El nombre debe tener entre 1 y 80 caracteres",
      );
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it("rechaza contraseñas de registro menores a 8 caracteres", async () => {
    const arbol = renderizarLogin();

    alternarARegistro(arbol);
    completarRegistro(arbol, { password: "corta7" });
    await pulsarBoton(arbol, "auth-submit-button");

    expect(textosDe(arbol)).toContain(
      "La contraseña debe tener al menos 8 caracteres",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("valida credenciales de login antes de llamar a la API", async () => {
    const arbol = renderizarLogin();

    cambiarTexto(arbol, "Correo electrónico", "correo-invalido");
    cambiarTexto(arbol, "Contraseña", "123");
    await pulsarBoton(arbol, "auth-submit-button");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(textosDe(arbol)).toContain("Correo o contraseña inválidos");
  });

  it("limpia la sesión si un 401 no puede renovarse", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta(401, { message: "No autorizado" }),
    );
    const arbol = renderizarLogin();

    cambiarTexto(arbol, "Correo electrónico", "test@test.com");
    cambiarTexto(arbol, "Contraseña", "wrong");
    await pulsarBoton(arbol, "auth-submit-button");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refreshToken");
    expect(textosDe(arbol)).toContain("No autorizado");
  });
});
