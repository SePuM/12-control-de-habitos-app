describe("configuración centralizada de API", () => {
  const valorOriginal = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (valorOriginal === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = valorOriginal;
    }
    jest.resetModules();
  });

  const apiBase = (): string => {
    const modulo = jest.requireActual("../src/api/config") as {
      API_BASE: string;
    };
    return modulo.API_BASE;
  };

  it("usa la URL local por defecto si no hay variable de entorno", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.resetModules();

    expect(apiBase()).toBe("http://192.168.1.92:3000");
  });

  it("recorta EXPO_PUBLIC_API_URL cuando está definida", () => {
    process.env.EXPO_PUBLIC_API_URL = "  https://mi-api.vercel.app  ";
    jest.resetModules();

    expect(apiBase()).toBe("https://mi-api.vercel.app");
  });
});
