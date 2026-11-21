import {
  SCHEMA_OFFLINE,
  aCambioPendiente,
  cambiosDesde,
  consultaCambiosPendientes,
  sqlEncolarCambio,
  sqlMarcarSincronizado,
  urlSincronizacion,
} from "../src/db/offline";

describe("base offline y sincronización", () => {
  it("define columnas remote_id, updated_at, deleted y pending", () => {
    expect(SCHEMA_OFFLINE).toContain("remote_id");
    expect(SCHEMA_OFFLINE).toContain("updated_at");
    expect(SCHEMA_OFFLINE).toContain("deleted");
    expect(SCHEMA_OFFLINE).toContain("pending");
  });

  it("define la tabla de último since", () => {
    expect(SCHEMA_OFFLINE).toContain(
      "CREATE TABLE IF NOT EXISTS sincronizaciones",
    );
    expect(SCHEMA_OFFLINE).toContain("clave TEXT PRIMARY KEY");
    expect(SCHEMA_OFFLINE).toContain("valor TEXT");
  });

  it("marca un cambio pendiente con updated_at", () => {
    const cambio = aCambioPendiente(
      {
        id: "c1",
        entidad: "habito",
        operacion: "actualizar",
        datos: { nombre: "Leer" },
      },
      "2026-11-21T10:00:00.000Z",
    );

    expect(cambio).toStrictEqual({
      id: "c1",
      entidad: "habito",
      operacion: "actualizar",
      datos: { nombre: "Leer" },
      updated_at: "2026-11-21T10:00:00.000Z",
    });
  });

  it("agrega ?since= a una ruta sin query", () => {
    expect(urlSincronizacion("/api/habito", "2026-11-20")).toBe(
      "/api/habito?since=2026-11-20",
    );
  });

  it("agrega &since= a una ruta con query", () => {
    expect(urlSincronizacion("/api/registro?fecha=2026-11-21", "abc 1")).toBe(
      "/api/registro?fecha=2026-11-21&since=abc%201",
    );
  });

  it("devuelve la ruta original si no hay desde", () => {
    expect(urlSincronizacion("/api/habito")).toBe("/api/habito");
  });

  it("filtra cambios posteriores al último since", () => {
    const cambios = [
      aCambioPendiente(
        { id: "a", entidad: "habito", operacion: "crear", datos: {} },
        "2026-11-19T00:00:00.000Z",
      ),
      aCambioPendiente(
        { id: "b", entidad: "registro", operacion: "actualizar", datos: {} },
        "2026-11-21T00:00:00.000Z",
      ),
    ];

    expect(cambiosDesde(cambios, "2026-11-20T00:00:00.000Z")).toStrictEqual([
      cambios[1],
    ]);
  });

  it("genera SQL para encolar, consultar y sincronizar cambios", () => {
    const cambio = aCambioPendiente(
      { id: "c1", entidad: "registro", operacion: "crear", datos: {} },
      "2026-11-21T10:00:00.000Z",
    );

    expect(sqlEncolarCambio(cambio)).toContain("cambios_pendientes");
    expect(sqlEncolarCambio(cambio)).toContain(cambio.id);
    expect(consultaCambiosPendientes("2026-11-20")).toMatchObject({
      sql: expect.stringContaining("pending = 1"),
      parametros: ["2026-11-20"],
    });
    expect(sqlMarcarSincronizado("c1")).toContain("pending = 0");
  });
});
