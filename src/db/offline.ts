export type EntidadOffline = "habito" | "registro";
export type OperacionOffline = "crear" | "actualizar" | "eliminar";

export type CambioPendiente = {
  id: string;
  entidad: EntidadOffline;
  operacion: OperacionOffline;
  datos: unknown;
  updated_at: string;
};

export const SCHEMA_OFFLINE = `
CREATE TABLE IF NOT EXISTS habitos (
  id TEXT PRIMARY KEY NOT NULL,
  remote_id TEXT,
  nombre TEXT NOT NULL,
  meta INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY NOT NULL,
  remote_id TEXT,
  habito_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cambios_pendientes (
  id TEXT PRIMARY KEY NOT NULL,
  entidad TEXT NOT NULL,
  operacion TEXT NOT NULL,
  datos TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pending INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sincronizaciones (
  clave TEXT PRIMARY KEY NOT NULL,
  valor TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros (fecha);
CREATE INDEX IF NOT EXISTS idx_cambios_pendientes ON cambios_pendientes (pending, updated_at);
`;

export const aCambioPendiente = (
  cambio: Omit<CambioPendiente, "updated_at">,
  fecha: string = new Date().toISOString(),
): CambioPendiente => ({ ...cambio, updated_at: fecha });

export const urlSincronizacion = (
  ruta: string,
  desde?: string | null,
): string => {
  const valor = desde?.trim();
  if (!valor) return ruta;
  const separador = ruta.includes("?") ? "&" : "?";
  return `${ruta}${separador}since=${encodeURIComponent(valor)}`;
};

export const cambiosDesde = (
  cambios: CambioPendiente[],
  desde: string,
): CambioPendiente[] => cambios.filter((cambio) => cambio.updated_at > desde);

const escaparSql = (valor: string): string => valor.replace(/'/g, "''");

export const sqlEncolarCambio = (cambio: CambioPendiente): string => {
  const id = escaparSql(cambio.id);
  const entidad = escaparSql(cambio.entidad);
  const operacion = escaparSql(cambio.operacion);
  const datos = escaparSql(JSON.stringify(cambio.datos) ?? "null");
  const updatedAt = escaparSql(cambio.updated_at);
  return `INSERT INTO cambios_pendientes (id, entidad, operacion, datos, updated_at, pending) VALUES ('${id}', '${entidad}', '${operacion}', '${datos}', '${updatedAt}', 1) ON CONFLICT(id) DO UPDATE SET entidad = excluded.entidad, operacion = excluded.operacion, datos = excluded.datos, updated_at = excluded.updated_at, pending = 1`;
};

export const consultaCambiosPendientes = (
  desde?: string | null,
): { sql: string; parametros: string[] } => {
  const base =
    "SELECT id, entidad, operacion, datos, updated_at FROM cambios_pendientes WHERE pending = 1";
  const valor = desde?.trim();
  if (!valor) return { sql: `${base} ORDER BY updated_at`, parametros: [] };
  return {
    sql: `${base} AND updated_at >= ? ORDER BY updated_at`,
    parametros: [valor],
  };
};

export const sqlMarcarSincronizado = (id: string): string =>
  `UPDATE cambios_pendientes SET pending = 0 WHERE id = '${escaparSql(id)}'`;
