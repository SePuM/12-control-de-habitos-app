import {
  validarFecha,
  validarMetaPasos,
  validarNombre,
  validarRegistro,
} from "../src/services/validacion";

describe("validaciones de negocio", () => {
  it.each(["", "a", "  a  "])("rechaza nombres cortos: %p", (nombre) => {
    expect(validarNombre(nombre)).toBe(
      "El nombre debe tener entre 2 y 40 caracteres",
    );
  });

  it("rechaza nombres de más de 40 caracteres", () => {
    expect(validarNombre("a".repeat(41))).toBe(
      "El nombre debe tener entre 2 y 40 caracteres",
    );
  });

  it.each(["Leer", "  Beber agua  "])(
    "acepta nombres válidos: %p",
    (nombre) => {
      expect(validarNombre(nombre)).toBeNull();
    },
  );

  it.each([499, 50001, 12.5, "abc"])(
    "rechaza metas de pasos inválidas: %p",
    (meta) => {
      expect(validarMetaPasos(meta)).toBe(
        "La meta de pasos debe estar entre 500 y 50.000",
      );
    },
  );

  it.each([500, 10000, 50000, " 800 "])(
    "acepta metas de pasos válidas: %p",
    (meta) => {
      expect(validarMetaPasos(meta)).toBeNull();
    },
  );

  it.each(["", "a".repeat(81)])(
    "rechaza nombres de registro inválidos: %p",
    (nombre) => {
      expect(validarRegistro(nombre, "test@test.com", "password123")).toBe(
        "El nombre debe tener entre 1 y 80 caracteres",
      );
    },
  );

  it("rechaza correos de registro inválidos", () => {
    expect(
      validarRegistro("Nuevo Usuario", "correo-invalido", "password123"),
    ).toBe("Correo electrónico inválido");
  });

  it("rechaza contraseñas de registro menores a 8 caracteres", () => {
    expect(validarRegistro("Nuevo Usuario", "test@test.com", "corta7")).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });

  it("acepta un registro válido", () => {
    expect(
      validarRegistro("  Nuevo Usuario  ", "test@test.com", "password123"),
    ).toBeNull();
  });

  const hoy = new Date(2026, 10, 21, 12, 0, 0);

  it.each(["2026-11-22", "2026-12-01", "2027-01-01"])(
    "rechaza la fecha futura %s",
    (fecha) => {
      expect(validarFecha(fecha, hoy)).toBe("No se permiten fechas futuras");
    },
  );

  it.each(["2026-11-20", "2026-11-21"])(
    "acepta la fecha pasada o actual %s",
    (fecha) => {
      expect(validarFecha(fecha, hoy)).toBeNull();
    },
  );

  it.each(["", "21-11-2026", "2026-11-31", "2026-02-30"])(
    "rechaza la fecha inválida %s",
    (fecha) => {
      expect(validarFecha(fecha, hoy)).toBe("Fecha inválida");
    },
  );
});
