import * as SecureStore from "expo-secure-store";
import type { SQLiteBindParams, SQLiteDatabase } from "expo-sqlite";

import { peticionAutenticada } from "../api/sesion";
import { inicializarBase } from "../db/client";
import {
  type CambioPendiente,
  type EntidadOffline,
  type OperacionOffline,
} from "../db/offline";
import {
  type BaseOffline,
  encolarCambio,
  listarPendientes,
  marcarSincronizado,
  rutaSincronizacion,
} from "../repositories/offline";

export type EntradaCambioOffline = {
  id?: string;
  entidad: EntidadOffline;
  operacion: OperacionOffline;
  datos: Record<string, unknown>;
};

export type HabitoLocal = {
  id?: string;
  _id?: string;
  nombre: string;
  meta?: number;
};

const fechaActual = (): string => new Date().toISOString();

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const numero = (valor: unknown): number =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : 1;

const generarId = (): string =>
  `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const escaparSql = (valor: string): string => valor.replace(/'/g, "''");

const adaptarBase = (base: SQLiteDatabase): BaseOffline => ({
  execAsync: (sql) => base.execAsync(sql),
  getAllAsync: (sql, parametros) =>
    base.getAllAsync(sql, (parametros ?? []) as SQLiteBindParams),
});

const datosDelCambio = (cambio: CambioPendiente): Record<string, unknown> => {
  if (typeof cambio.datos !== "object" || cambio.datos === null) return {};
  return cambio.datos as Record<string, unknown>;
};

export const guardarHabilidadesLocales = async (
  habitos: HabitoLocal[],
  fecha: string = fechaActual(),
): Promise<void> => {
  const base = await inicializarBase();
  await Promise.all(
    habitos.map((habito) => {
      const id = texto(habito.id ?? habito._id);
      if (!id) return Promise.resolve();
      const remoteId = texto(habito._id) || id;
      return base.execAsync(
        `INSERT INTO habitos (id, remote_id, nombre, meta, updated_at, deleted, pending)
         VALUES ('${escaparSql(id)}', '${escaparSql(remoteId)}', '${escaparSql(habito.nombre)}', ${numero(habito.meta)}, '${escaparSql(fecha)}', 0, 0)
         ON CONFLICT(id) DO UPDATE SET remote_id = excluded.remote_id,
          nombre = excluded.nombre, meta = excluded.meta,
          updated_at = excluded.updated_at, deleted = 0, pending = 0`,
      );
    }),
  );
};

const habitoDe = (fila: unknown): HabitoLocal | null => {
  if (typeof fila !== "object" || fila === null) return null;
  const filaHabito = fila as {
    id?: unknown;
    remote_id?: unknown;
    nombre?: unknown;
    meta?: unknown;
  };
  const id = texto(filaHabito.id);
  const nombre = texto(filaHabito.nombre);
  if (!id || !nombre) return null;
  const remoteId = texto(filaHabito.remote_id);
  return {
    id,
    ...(remoteId ? { _id: remoteId } : {}),
    nombre,
    meta: numero(filaHabito.meta),
  };
};

export const leerHabilidadesLocales = async (): Promise<HabitoLocal[]> => {
  const base = await inicializarBase();
  const filas = await base.getAllAsync(
    "SELECT id, remote_id, nombre, meta FROM habitos WHERE deleted = 0 AND pending = 0 ORDER BY nombre",
  );
  return filas
    .map(habitoDe)
    .filter((habito): habito is HabitoLocal => habito !== null);
};

export const registrarCambioOffline = async (
  entrada: EntradaCambioOffline,
  fecha: string = fechaActual(),
): Promise<CambioPendiente> => {
  const base = await inicializarBase();
  const id = entrada.id?.trim() || generarId();
  const datos = {
    ...entrada.datos,
    remote_id: texto(entrada.datos.remote_id) || id,
    deleted: entrada.operacion === "eliminar" ? 1 : 0,
    updated_at: fecha,
    pending: 1,
  };
  return encolarCambio(
    adaptarBase(base),
    { id, entidad: entrada.entidad, operacion: entrada.operacion, datos },
    fecha,
  );
};

export const confirmarCambioOffline = async (id: string): Promise<void> => {
  const base = await inicializarBase();
  await marcarSincronizado(adaptarBase(base), id);
};

const rutaDelCambio = (cambio: CambioPendiente): string => {
  const datos = datosDelCambio(cambio);
  const id = texto(datos.remote_id) || texto(datos.id) || cambio.id;
  if (cambio.entidad === "habito") return `/api/habito/${id}`;
  return `/api/registro_habito/${texto(datos.habitoId)}/${texto(datos.fecha)}`;
};

const esEliminacion = (cambio: CambioPendiente): boolean => {
  const datos = datosDelCambio(cambio);
  return (
    cambio.operacion === "eliminar" ||
    datos.deleted === 1 ||
    datos.deleted === true
  );
};

const leerUltimaSincronizacion = async (
  base: BaseOffline,
): Promise<string | null> => {
  const filas = await base.getAllAsync(
    "SELECT valor FROM sincronizaciones WHERE clave = 'ultima'",
  );
  const primera = filas[0] as { valor?: unknown } | undefined;
  return texto(primera?.valor) || null;
};

const guardarUltimaSincronizacion = async (
  base: BaseOffline,
  fecha: string,
): Promise<void> => {
  await base.execAsync(
    `INSERT INTO sincronizaciones (clave, valor) VALUES ('ultima', '${escaparSql(fecha)}')
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
  );
};

const sincronizarUno = async (
  base: BaseOffline,
  cambio: CambioPendiente,
  desde: string | null,
  headers: Record<string, string>,
): Promise<boolean> => {
  try {
    const respuesta = await peticionAutenticada(
      rutaSincronizacion(rutaDelCambio(cambio), desde),
      {
        method: esEliminacion(cambio) ? "DELETE" : "PUT",
        headers,
        body: JSON.stringify(datosDelCambio(cambio)),
      },
    );
    if (respuesta.status < 200 || respuesta.status >= 300) return false;
    await marcarSincronizado(base, cambio.id);
    return true;
  } catch {
    return false;
  }
};

export const sincronizarCambios = async (): Promise<number> => {
  const base = await inicializarBase();
  const adaptado = adaptarBase(base);
  const desde = await leerUltimaSincronizacion(adaptado);
  const pendientes = await listarPendientes(adaptado, desde);
  const token = await SecureStore.getItemAsync("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  let sincronizados = 0;
  for (const cambio of pendientes) {
    if (await sincronizarUno(adaptado, cambio, desde, headers))
      sincronizados += 1;
  }
  await guardarUltimaSincronizacion(adaptado, fechaActual());
  return sincronizados;
};
