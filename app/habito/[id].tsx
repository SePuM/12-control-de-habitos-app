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
import { registrarCambioOffline } from "../../src/services/offline-sync";

type Registro = { fecha: string; cantidad: number };
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

const registrosDe = (valor: unknown): Registro[] => {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((entrada) => {
      const registro = entrada as {
        fecha?: unknown;
        cantidad?: unknown;
        deleted_at?: unknown;
        deleted?: unknown;
      };
      return {
        fecha: texto(registro.fecha),
        cantidad: numero(registro.cantidad),
        borrado: registro.deleted_at != null || registro.deleted === true,
      };
    })
    .filter((registro) => registro.fecha.length > 0 && !registro.borrado)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5)
    .map(({ fecha, cantidad }) => ({ fecha, cantidad }));
};

const resumenDe = (
  datos: DatosEstadisticas,
  fecha: string,
  registros: Registro[],
  meta: number,
): Resumen => {
  const cantidadHoy =
    registros.find((item) => item.fecha === fecha)?.cantidad ?? 0;
  const porcentaje = meta > 0 ? Math.round((cantidadHoy * 100) / meta) : 0;
  return {
    racha: numero(datos.racha ?? datos.rachaActual ?? datos.racha_actual),
    mejorRacha: numero(datos.mejorRacha ?? datos.mejor_racha),
    progreso: Math.min(100, porcentaje),
    estado:
      porcentaje >= 100
        ? "Completado"
        : porcentaje > 0
          ? "En progreso"
          : "Pendiente",
    registros,
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
        registros.map((registro) => (
          <Text key={registro.fecha} style={styles.dato}>
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
  const [racha, setRacha] = useState(0);
  const [mejorRacha, setMejorRacha] = useState(0);
  const [meta, setMeta] = useState(numero(parametros.meta));
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
      const token = await SecureStore.getItemAsync("token");
      const respuesta = await peticionAutenticada(
        `${API_BASE}/api/registro_habito/estadisticas?fecha=${fecha}`,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } },
        alExpirar,
      );
      if (respuesta.status !== 200 && respuesta.status !== 201) {
        setError("No se pudo cargar el historial");
        return;
      }
      const datos = normalizarDatos(await respuesta.json());
      if (!nombreParam) setNombre(nombreDe(datos) || "Historial del hábito");
      setRacha(numero(datos.racha ?? datos.rachaActual ?? datos.racha_actual));
      setMejorRacha(numero(datos.mejorRacha ?? datos.mejor_racha));
      setMeta(numero(datos.meta ?? parametros.meta));
      setRegistros(registrosDe(datos.registros));
    } catch {
      setError("No se pudo cargar el historial");
    }
  }, [alExpirar, fecha, nombreParam, parametros.meta]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const registrarPasos = useCallback(async () => {
    const valor = Number(entradaPasos);
    if (entradaPasos.trim() && (!Number.isFinite(valor) || valor < 1)) {
      setMensaje("Ingresa un número de pasos ≥ 1");
      return;
    }
    const cantidad = entradaPasos.trim() ? Math.trunc(valor) : 1000;
    try {
      await registrarCambioOffline({
        entidad: "registro",
        operacion: "crear",
        datos: { habitoId: id, fecha, cantidad, remote_id: id },
      });
      const total = pasos + cantidad;
      setPasos(total);
      pedometro.registrarManual(total);
      setMensaje(`Pasos registrados: ${total}`);
    } catch {
      setMensaje("No se pudo guardar el registro");
    }
  }, [entradaPasos, fecha, id, pasos, pedometro]);

  const registrarCronometro = () => {
    const total = segundosManuales + 60;
    setSegundosManuales(total);
    acelerometro.registrarManual(total);
  };

  const resumen = resumenDe(
    normalizarDatos({
      racha,
      mejorRacha,
      registros,
    }),
    fecha,
    registros,
    meta,
  );

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
          onRegistrarCronometro={registrarCronometro}
          onIniciarCronometro={() => void acelerometro.iniciar()}
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
