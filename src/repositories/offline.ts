import {
  aCambioPendiente,
  consultaCambiosPendientes,
  sqlEncolarCambio,
  sqlMarcarSincronizado,
  urlSincronizacion,
  type CambioPendiente,
  type EntidadOffline,
  type OperacionOffline,
} from "../db/offline";

export type BaseOffline = {
  execAsync: (sql: string, parametros?: unknown[]) => Promise<void>;
  getAllAsync: (sql: string, parametros?: unknown[]) => Promise<unknown[]>;
};

type EntradaCambio = Omit<CambioPendiente, "updated_at">;

const textoDe = (valor: unknown): string =>
  typeof valor === "string" ? valor : "";

const entidadDe = (valor: unknown): EntidadOffline =>
  valor === "registro" ? "registro" : "habito";

const operacionDe = (valor: unknown): OperacionOffline => {
  if (valor === "crear" || valor === "eliminar") return valor;
  return "actualizar";
};

const datosDe = (valor: unknown): unknown => {
  if (typeof valor !== "string") return null;
  try {
    const resultado: unknown = JSON.parse(valor);
    return resultado;
  } catch {
    return valor;
  }
};

const cambioDe = (fila: unknown): CambioPendiente | null => {
  if (typeof fila !== "object" || fila === null) return null;
  const registro = fila as {
    id?: unknown;
    entidad?: unknown;
    operacion?: unknown;
    datos?: unknown;
    updated_at?: unknown;
  };
  const id = textoDe(registro.id);
  if (!id) return null;
  return {
    id,
    entidad: entidadDe(registro.entidad),
    operacion: operacionDe(registro.operacion),
    datos: datosDe(registro.datos),
    updated_at: textoDe(registro.updated_at),
  };
};

export const encolarCambio = async (
  base: BaseOffline,
  cambio: EntradaCambio,
  fecha?: string,
): Promise<CambioPendiente> => {
  const guardado = aCambioPendiente(cambio, fecha);
  await base.execAsync(sqlEncolarCambio(guardado));
  return guardado;
};

export const listarPendientes = async (
  base: BaseOffline,
  desde?: string | null,
): Promise<CambioPendiente[]> => {
  const consulta = consultaCambiosPendientes(desde);
  const filas = await base.getAllAsync(consulta.sql, consulta.parametros);
  return filas
    .map(cambioDe)
    .filter((cambio): cambio is CambioPendiente => cambio !== null);
};

export const marcarSincronizado = async (
  base: BaseOffline,
  id: string,
): Promise<void> => {
  await base.execAsync(sqlMarcarSincronizado(id));
};

export const rutaSincronizacion = (
  ruta: string,
  desde?: string | null,
): string => urlSincronizacion(ruta, desde);
