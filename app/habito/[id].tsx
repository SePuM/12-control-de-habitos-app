import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { API_BASE } from "../../src/api/config";
import { peticionAutenticada } from "../../src/api/sesion";
import { useAcelerometro } from "../../src/sensors/use-acelerometro";
import { usePedometro } from "../../src/sensors/use-pedometro";
import {
  gestosConBoton,
  type GestosAccesibles,
} from "../../src/sensors/seguridad";
import {
  leerHabilidadesLocales,
  leerRegistrosLocales,
  registrarCambioOffline,
  sincronizarCambios,
} from "../../src/services/offline-sync";

type Registro = {
  id?: string;
  fecha: string;
  cantidad: number;
  tipo: string;
  updated_at?: string;
};
type DatosEstadisticas = {
  nombre?: unknown;
  etiqueta?: unknown;
  habito?: unknown;
  racha?: unknown;
  rachaActual?: unknown;
  racha_actual?: unknown;
  mejorRacha?: unknown;
  mejor_racha?: unknown;
  meta?: unknown;
  registros?: unknown;
  datos?: unknown;
};
type Resumen = {
  racha: number;
  mejorRacha: number;
  progreso: number;
  estado: string;
  registros: Registro[];
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const valorUnico = (valor: unknown): string =>
  Array.isArray(valor) ? texto(valor[0]) : texto(valor);

const numero = (valor: unknown): number =>
  typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : typeof valor === "string" && /^\d+$/.test(valor)
      ? Number(valor)
      : 0;

export const fechaLocal = (fecha: Date = new Date()): string =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

const normalizarDatos = (respuesta: unknown): DatosEstadisticas => {
  if (Array.isArray(respuesta)) return { registros: respuesta };
  if (typeof respuesta !== "object" || respuesta === null) return {};
  const datos = respuesta as DatosEstadisticas;
  if (Array.isArray(datos.registros)) return datos;
  if (Array.isArray(datos.datos)) return { ...datos, registros: datos.datos };
  return datos;
};

const nombreDe = (datos: DatosEstadisticas): string => {
  const habito = datos.habito as { nombre?: unknown; name?: unknown } | null;
  return (
    texto(datos.nombre) ||
    texto(datos.etiqueta) ||
    texto(habito?.nombre) ||
    texto(habito?.name)
  );
};

type RegistroNormalizado = Registro & { borrado: boolean };

const ordenRegistros = (a: Registro, b: Registro): number =>
  b.fecha.localeCompare(a.fecha) ||
  (b.updated_at ?? "").localeCompare(a.updated_at ?? "");

const registrosDe = (valor: unknown): Registro[] => {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((entrada) => {
      const registro = entrada as {
        id?: unknown;
        fecha?: unknown;
        cantidad?: unknown;
        tipo?: unknown;
        updated_at?: unknown;
        deleted_at?: unknown;
        deleted?: unknown;
        borrado?: unknown;
      };
      const fecha = texto(registro.fecha);
      const id = texto(registro.id);
      const updatedAt = texto(registro.updated_at);
      const borrado =
        registro.deleted_at != null ||
        registro.deleted === true ||
        registro.borrado === true;
      const normalizado: RegistroNormalizado = {
        ...(id ? { id } : {}),
        fecha,
        cantidad: numero(registro.cantidad),
        tipo: texto(registro.tipo) || "checkin",
        ...(updatedAt ? { updated_at: updatedAt } : {}),
        borrado,
      };
      return normalizado;
    })
    .filter((registro) => registro.fecha.length > 0 && !registro.borrado)
    .sort(ordenRegistros)
    .slice(0, 8)
    .map(({ id, fecha, cantidad, tipo, updated_at }) => ({
      ...(id ? { id } : {}),
      fecha,
      cantidad,
      tipo,
      ...(updated_at ? { updated_at } : {}),
    }));
};

const diaAnterior = (fecha: string): string => {
  const fechaAnterior = new Date(`${fecha}T00:00:00Z`);
  fechaAnterior.setUTCDate(fechaAnterior.getUTCDate() - 1);
  return fechaAnterior.toISOString().slice(0, 10);
};

const fechasUnicas = (registros: Registro[]): string[] =>
  Array.from(new Set(registros.map((registro) => registro.fecha)))
    .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    .sort((a, b) => b.localeCompare(a));

const mejorRachaDe = (registros: Registro[]): number => {
  const fechas = fechasUnicas(registros).reverse();
  let mejor = 0;
  let actual = 0;
  let anterior = "";
  fechas.forEach((fecha) => {
    actual = anterior && diaAnterior(fecha) === anterior ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    anterior = fecha;
  });
  return mejor;
};

const rachaActualDe = (registros: Registro[], fechaHoy: string): number => {
  const fechas = fechasUnicas(registros);
  if (fechas.length === 0) return 0;
  if (fechas[0] !== fechaHoy && fechas[0] !== diaAnterior(fechaHoy)) return 0;
  let racha = 1;
  let esperado = diaAnterior(fechas[0]);
  for (const fecha of fechas.slice(1)) {
    if (fecha !== esperado) break;
    racha += 1;
    esperado = diaAnterior(esperado);
  }
  return racha;
};

const claveRegistro = (registro: Registro): string =>
  `${registro.fecha}|${registro.tipo}|${registro.id ?? registro.cantidad}`;

const unirRegistros = (...listas: Registro[][]): Registro[] => {
  const porClave = new Map<string, Registro>();
  listas.flat().forEach((registro) => {
    porClave.set(claveRegistro(registro), registro);
  });
  return Array.from(porClave.values()).sort(ordenRegistros).slice(0, 8);
};

const resumenDe = (
  registros: Registro[],
  fecha: string,
  meta: number,
): Resumen => {
  const cantidadHoy = registros
    .filter((registro) => registro.fecha === fecha)
    .reduce((total, registro) => total + Math.max(0, registro.cantidad), 0);
  const metaEfectiva = meta > 0 ? meta : 1;
  const porcentaje = Math.round((cantidadHoy * 100) / metaEfectiva);
  return {
    racha: rachaActualDe(registros, fecha),
    mejorRacha: mejorRachaDe(registros),
    progreso: Math.min(100, porcentaje),
    estado: cantidadHoy >= metaEfectiva ? "Completado" : "Pendiente",
    registros,
  };
};

const sumaPorTipo = (registros: Registro[], tipos: string[]): number =>
  registros
    .filter((registro) => tipos.includes(registro.tipo))
    .reduce((total, registro) => total + registro.cantidad, 0);

type DatosRemotos = { nombre: string; meta: number; registros: Registro[] };

const cargarDatosRemotos = async (
  fecha: string,
  alExpirar: () => void,
): Promise<DatosRemotos> => {
  const token = await SecureStore.getItemAsync("token");
  if (!token) return { nombre: "", meta: 0, registros: [] };
  const respuesta = await peticionAutenticada(
    `${API_BASE}/api/registro_habito/estadisticas?fecha=${fecha}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    alExpirar,
  );
  if (respuesta.status !== 200 && respuesta.status !== 201) {
    return { nombre: "", meta: 0, registros: [] };
  }
  const datos = normalizarDatos(await respuesta.json());
  return {
    nombre: nombreDe(datos),
    meta: numero(datos.meta),
    registros: registrosDe(datos.registros),
  };
};

function Encabezado({
  nombre,
  gestos,
}: {
  nombre: string;
  gestos: GestosAccesibles;
}) {
  return (
    <View style={styles.encabezado}>
      <TouchableOpacity {...gestos} style={styles.volver}>
        <Text style={styles.volverTexto}>Volver</Text>
      </TouchableOpacity>
      <Text style={styles.eyebrow}>HISTORIAL Y ESTADÍSTICAS</Text>
      <Text style={styles.title}>{nombre}</Text>
    </View>
  );
}

function SeccionEstadisticas({ resumen }: { resumen: Resumen }) {
  return (
    <View style={styles.seccion} testID="detalle-estadisticas">
      <Text style={styles.tituloSeccion}>Estadísticas</Text>
      <Text style={styles.dato}>{`Racha actual: ${resumen.racha}`}</Text>
      <Text style={styles.dato}>{`Mejor racha: ${resumen.mejorRacha}`}</Text>
      <Text style={styles.dato}>{`Progreso: ${resumen.progreso}%`}</Text>
      <Text style={styles.dato}>{`Estado: ${resumen.estado}`}</Text>
    </View>
  );
}

function SeccionRegistros({ registros }: { registros: Registro[] }) {
  return (
    <View style={styles.seccion} testID="detalle-registros">
      <Text style={styles.tituloSeccion}>Registros recientes</Text>
      {registros.length === 0 ? (
        <Text style={styles.estado}>Sin registros recientes</Text>
      ) : (
        registros.map((registro, indice) => (
          <Text
            key={`${registro.fecha}-${registro.id ?? indice}`}
            style={styles.dato}
          >
            {`${registro.fecha} · ${Math.max(1, registro.cantidad)}`}
          </Text>
        ))
      )}
    </View>
  );
}

type SensoresProps = {
  pedometro: ReturnType<typeof usePedometro>;
  acelerometro: ReturnType<typeof useAcelerometro>;
  entradaPasos: string;
  segundosManuales: number;
  mensaje: string | null;
  onEntradaPasos: (valor: string) => void;
  onRegistrarPasos: () => void;
  onIniciarPodometro: () => void;
  onRegistrarCronometro: () => void;
  onIniciarCronometro: () => void;
};

type PasosProps = Pick<
  SensoresProps,
  | "pedometro"
  | "entradaPasos"
  | "onEntradaPasos"
  | "onRegistrarPasos"
  | "onIniciarPodometro"
>;

type CronometroProps = Pick<
  SensoresProps,
  | "acelerometro"
  | "segundosManuales"
  | "onRegistrarCronometro"
  | "onIniciarCronometro"
>;

function SeccionPasos(props: PasosProps) {
  const sinPodometro = props.pedometro.estado === "no-disponible";
  return (
    <>
      <Text style={styles.tituloSeccion}>Registro de pasos</Text>
      <Text style={styles.ayuda}>Registra pasos en este hábito</Text>
      {sinPodometro && (
        <Text style={styles.estado}>
          Podómetro no disponible; usa entrada manual
        </Text>
      )}
      <Text style={styles.dato}>{`Podómetro: ${props.pedometro.estado}`}</Text>
      <Text style={styles.dato}>
        {`Pasos del podómetro: ${props.pedometro.pasos}`}
      </Text>
      <TextInput
        style={styles.input}
        testID="pasos-manuales-input"
        accessibilityLabel="Cantidad de pasos manuales"
        keyboardType="numeric"
        placeholder="Ej. 1000"
        value={props.entradaPasos}
        onChangeText={props.onEntradaPasos}
      />
      <TouchableOpacity
        accessibilityLabel="Manual de pasos"
        testID="manual-pasos-button"
        style={styles.boton}
        onPress={props.onRegistrarPasos}
      >
        <Text style={styles.botonTexto}>Manual de pasos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Iniciar podómetro"
        testID="pedometro-button"
        style={styles.boton}
        onPress={props.onIniciarPodometro}
      >
        <Text style={styles.botonTexto}>Iniciar podómetro</Text>
      </TouchableOpacity>
    </>
  );
}

function SeccionCronometro(props: CronometroProps) {
  return (
    <>
      <Text style={styles.tituloSeccion}>Cronómetro</Text>
      <Text style={styles.ayuda}>
        Registra tiempo o movimiento en este hábito
      </Text>
      <Text style={styles.dato}>
        {`Acelerómetro: ${props.acelerometro.estado}`}
      </Text>
      <Text style={styles.dato}>
        {`Movimientos: ${props.acelerometro.movimientos}`}
      </Text>
      <Text style={styles.dato}>
        {`Cronómetro manual: ${props.segundosManuales} s`}
      </Text>
      <TouchableOpacity
        accessibilityLabel="Cronómetro manual"
        testID="cronometro-manual-button"
        style={styles.boton}
        onPress={props.onRegistrarCronometro}
      >
        <Text style={styles.botonTexto}>Registrar 60 s</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Iniciar cronómetro con acelerómetro"
        testID="cronometro-acelerometro-button"
        style={styles.boton}
        onPress={props.onIniciarCronometro}
      >
        <Text style={styles.botonTexto}>Iniciar cronómetro real</Text>
      </TouchableOpacity>
    </>
  );
}

function SeccionSensores(props: SensoresProps) {
  return (
    <View style={styles.seccion} testID="detalle-sensores">
      <Text style={styles.tituloSeccion}>Sensores y registro manual</Text>
      <SeccionPasos
        pedometro={props.pedometro}
        entradaPasos={props.entradaPasos}
        onEntradaPasos={props.onEntradaPasos}
        onRegistrarPasos={props.onRegistrarPasos}
        onIniciarPodometro={props.onIniciarPodometro}
      />
      <SeccionCronometro
        acelerometro={props.acelerometro}
        segundosManuales={props.segundosManuales}
        onRegistrarCronometro={props.onRegistrarCronometro}
        onIniciarCronometro={props.onIniciarCronometro}
      />
      {props.mensaje && <Text style={styles.mensaje}>{props.mensaje}</Text>}
    </View>
  );
}

export default function DetalleHabitoScreen() {
  const parametros = useLocalSearchParams();
  const router = useRouter();
  const id = valorUnico(parametros.id) || "sin-id";
  const nombreParam =
    valorUnico(parametros.nombre) || valorUnico(parametros.etiqueta);
  const fecha = fechaLocal();
  const pedometro = usePedometro();
  const acelerometro = useAcelerometro();
  const [nombre, setNombre] = useState(nombreParam || "Historial del hábito");
  const [meta, setMeta] = useState(numero(parametros.meta) || 1);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [entradaPasos, setEntradaPasos] = useState("");
  const [pasos, setPasos] = useState(0);
  const [segundosManuales, setSegundosManuales] = useState(0);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const gestos = gestosConBoton(() => router.back(), "Volver");
  const alExpirar = useCallback(() => router.replace("/login"), [router]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      await sincronizarCambios();
      const [locales, habitos, remotos] = await Promise.all([
        leerRegistrosLocales(id),
        leerHabilidadesLocales(),
        cargarDatosRemotos(fecha, alExpirar),
      ]);
      const habitoLocal = habitos.find(
        (habito) => habito.id === id || habito._id === id,
      );
      if (!nombreParam) {
        setNombre(
          remotos.nombre || habitoLocal?.nombre || "Historial del hábito",
        );
      }
      setMeta(
        remotos.meta ||
          numero(parametros.meta) ||
          numero(habitoLocal?.meta) ||
          1,
      );
      const todos = unirRegistros(registrosDe(locales), remotos.registros);
      setRegistros(todos);
      setPasos(sumaPorTipo(todos, ["pasos"]));
      setSegundosManuales(sumaPorTipo(todos, ["tiempo", "movimiento"]));
    } catch {
      setError("No se pudo cargar el historial");
    }
  }, [alExpirar, fecha, id, nombreParam, parametros.meta]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const guardarRegistro = useCallback(
    async (valor: number, tipo: string): Promise<boolean> => {
      try {
        await registrarCambioOffline({
          entidad: "registro",
          operacion: "crear",
          datos: { habitoId: id, fecha, cantidad: valor, tipo, remote_id: id },
        });
        return true;
      } catch {
        return false;
      }
    },
    [fecha, id],
  );

  const registrarPasos = useCallback(async () => {
    const valor = Number(entradaPasos);
    if (entradaPasos.trim() && (!Number.isFinite(valor) || valor < 1)) {
      setMensaje("Ingresa un número de pasos ≥ 1");
      return;
    }
    const cantidad = entradaPasos.trim() ? Math.trunc(valor) : 1000;
    const guardado = await guardarRegistro(cantidad, "pasos");
    if (!guardado) {
      setMensaje("No se pudo guardar el registro");
      return;
    }
    const total = pasos + cantidad;
    setPasos(total);
    setRegistros((actuales) =>
      unirRegistros(actuales, [
        {
          fecha,
          cantidad,
          tipo: "pasos",
          updated_at: new Date().toISOString(),
        },
      ]),
    );
    pedometro.registrarManual(total);
    setMensaje(`Pasos registrados: ${total}`);
  }, [entradaPasos, fecha, guardarRegistro, pasos, pedometro]);

  const registrarTiempo = useCallback(
    async (tipo: "tiempo" | "movimiento") => {
      const total = segundosManuales + 60;
      const guardado = await guardarRegistro(60, tipo);
      if (!guardado) {
        setMensaje("No se pudo guardar el registro");
        return;
      }
      setSegundosManuales(total);
      setRegistros((actuales) =>
        unirRegistros(actuales, [
          {
            fecha,
            cantidad: 60,
            tipo,
            updated_at: new Date().toISOString(),
          },
        ]),
      );
      acelerometro.registrarManual(total);
      if (tipo === "movimiento") void acelerometro.iniciar();
      else setMensaje(`Cronómetro manual: ${total} s`);
    },
    [acelerometro, fecha, guardarRegistro, segundosManuales],
  );

  const resumen = resumenDe(registros, fecha, meta);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Encabezado nombre={nombre} gestos={gestos} />
        {error && <Text style={styles.error}>{error}</Text>}
        <SeccionEstadisticas resumen={resumen} />
        <SeccionRegistros registros={registros} />
        <SeccionSensores
          pedometro={pedometro}
          acelerometro={acelerometro}
          entradaPasos={entradaPasos}
          segundosManuales={segundosManuales}
          mensaje={mensaje}
          onEntradaPasos={setEntradaPasos}
          onRegistrarPasos={() => void registrarPasos()}
          onIniciarPodometro={() => void pedometro.iniciar()}
          onRegistrarCronometro={() => void registrarTiempo("tiempo")}
          onIniciarCronometro={() => void registrarTiempo("movimiento")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D10" },
  content: { padding: 20 },
  encabezado: { marginBottom: 20 },
  volver: {
    alignSelf: "flex-start",
    backgroundColor: "#232A36",
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  volverTexto: { color: "#D4AF37" },
  eyebrow: { color: "#D4AF37", fontSize: 12, letterSpacing: 2 },
  title: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  seccion: {
    backgroundColor: "#141820",
    borderRadius: 16,
    marginTop: 16,
    padding: 16,
  },
  tituloSeccion: {
    color: "#D4AF37",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  ayuda: { color: "#8E98A8", fontSize: 13, marginTop: 4 },
  dato: { color: "#F5F7FA", marginTop: 8 },
  estado: { color: "#8E98A8", marginTop: 8 },
  mensaje: { color: "#D4AF37", marginTop: 12 },
  error: { color: "#FF6B6B", marginTop: 12 },
  input: {
    borderColor: "#232A36",
    borderRadius: 12,
    borderWidth: 1,
    color: "#F5F7FA",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boton: {
    backgroundColor: "#232A36",
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  botonTexto: { color: "#D4AF37", fontWeight: "600", textAlign: "center" },
});
