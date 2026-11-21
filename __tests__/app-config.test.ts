import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ConfiguracionApp {
  expo: {
    android?: {
      permissions?: string[];
      predictiveBackGestureEnabled?: boolean;
    };
    plugins?: string[];
  };
}

describe("configuración Android de la app", () => {
  const configuracion = JSON.parse(
    readFileSync(join(process.cwd(), "app.json"), "utf8"),
  ) as ConfiguracionApp;

  it("declara los permisos mínimos para pasos y vibración", () => {
    expect(configuracion.expo.android?.permissions).toEqual(
      expect.arrayContaining(["ACTIVITY_RECOGNITION", "VIBRATE"]),
    );
  });

  it("conserva la configuración base existente", () => {
    expect(configuracion.expo.android?.predictiveBackGestureEnabled).toBe(
      false,
    );
    expect(configuracion.expo.plugins).toEqual(
      expect.arrayContaining(["expo-sqlite", "expo-secure-store"]),
    );
  });
});
