import * as SQLite from "expo-sqlite";

import { SCHEMA_OFFLINE } from "./offline";

export const abrirBase = (): Promise<SQLite.SQLiteDatabase> =>
  SQLite.openDatabaseAsync("habitos.db");

export const inicializarBase = async (): Promise<SQLite.SQLiteDatabase> => {
  const base = await abrirBase();
  await base.execAsync(SCHEMA_OFFLINE);
  return base;
};
