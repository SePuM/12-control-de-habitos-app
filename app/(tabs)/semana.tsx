import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { API_BASE } from "../../src/api/config";
import { peticionAutenticada } from "../../src/api/sesion";
import GestoAccesible from "../../src/components/gesto-accesible";

export type RegistroSemana = {
  fecha: string;
  cantidad: number;
  activo: boolean;
};

export type DiaSemana = {
  fecha: string;
  cantidad: number;
  cumplido: boolean;
};

const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

const numero = (valor: unknown): number =>
  typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : typeof valor === "string" && /^\d+$/.test(valor)
      ? Number(valor)
      : 0;

export const fechaLocal = (fecha: Date = new Date()): string =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

export const inicioDeSemana = (fecha: Date = new Date()): Date => {
  const inicio = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
  );
  const dia = inicio.getDay();
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  inicio.setDate(inicio.getDate() + desplazamiento);
  return inicio;
};

const fechaDeIndice = (inicio: Date, indice: number): Date => {
  const fecha = new Date(inicio);
  fecha.setDate(fecha.getDate() + (indice - 1) * 7);
  return fecha;
};

export const diasDeSemana = (inicio: Date, indice: number): string[] => {
  const comienzo = fechaDeIndice(inicio, indice);
  return Array.from({ length: 7 }, (_, desplazamiento) => {
    const fecha = new Date(comienzo);
    fecha.setDate(fecha.getDate() + desplazamiento);
    return fechaLocal(fecha);
  });
};

export const rangoDeSemana = (inicio: Date, indice: number): string => {
  const fechas = diasDeSemana(inicio, indice);
  return `${fechas[0]} — ${fechas[fechas.length - 1]}`;
};

const listaDe = (respuesta: unknown): unknown[] => {
  if (Array.isArray(respuesta)) return respuesta;
  if (typeof respuesta !== "object" || respuesta === null) return [];
  const contenedor = respuesta as { registros?: unknown; datos?: unknown };
  const lista = contenedor.registros ?? contenedor.datos;
  return Array.isArray(lista) ? lista : [];
};

export const registrosDeRespuesta = (
  respuesta: unknown,
  fecha: string,
): RegistroSemana[] =>
  listaDe(respuesta)
    .map((valor) => {
      const registro = valor as {
        fecha?: unknown;
        cantidad?: unknown;
        deleted_at?: unknown;
        deleted?: unknown;
      };
      return {
        fecha: texto(registro.fecha) || fecha,
        cantidad: numero(registro.cantidad),
        activo: registro.deleted_at == null && registro.deleted !== true,
      };
    })
    .filter((registro) => registro.activo);

export const resumenDeRegistros = (
  fechas: string[],
  registros: RegistroSemana[],
): { dias: DiaSemana[]; porcentaje: number } => {
  const dias = fechas.map((fecha) => {
    const delDia = registros.filter((registro) => registro.fecha === fecha);
    return {
      fecha,
      cantidad: delDia.reduce(
        (total, registro) => total + registro.cantidad,
        0,
      ),
      cumplido: delDia.length > 0,
    };
  });
  const cumplidos = dias.filter((dia) => dia.cumplido).length;
  const porcentaje = fechas.length
    ? Math.round((cumplidos * 100) / fechas.length)
    : 0;
  return { dias, porcentaje };
};

export default function SemanaScreen() {
  const [semana, setSemana] = useState(1);
  const [inicio] = useState(() => inicioDeSemana());
  const [dias, setDias] = useState<DiaSemana[]>(() =>
    diasDeSemana(inicio, 1).map((fecha) => ({
      fecha,
      cantidad: 0,
      cumplido: false,
    })),
  );
  const [porcentaje, setPorcentaje] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const alExpirar = useCallback(() => router.replace("/login"), [router]);

  const avanzar = () => setSemana((actual) => actual + 1);
  const retroceder = () => setSemana((actual) => Math.max(1, actual - 1));
  const volverHoy = () => {
    setSemana(1);
    router.push("/dashboard");
  };

  const cargar = useCallback(async () => {
    setError(null);
    const fechas = diasDeSemana(inicio, semana);
    try {
      const token = await SecureStore.getItemAsync("token");
      const headers = { Authorization: `Bearer ${token}` };
      const respuestas = await Promise.all(
        fechas.map((fecha) =>
          peticionAutenticada(
            `${API_BASE}/api/registro_habito?fecha=${fecha}`,
            { method: "GET", headers },
            alExpirar,
          ),
        ),
      );
      const grupos = await Promise.all(
        respuestas.map(async (respuesta, indice) =>
          respuesta.status === 200 || respuesta.status === 201
            ? registrosDeRespuesta(await respuesta.json(), fechas[indice] ?? "")
            : [],
        ),
      );
      const resumen = resumenDeRegistros(fechas, grupos.flat());
      setDias(resumen.dias);
      setPorcentaje(resumen.porcentaje);
    } catch {
      setError("No se pudo cargar la semana");
    }
  }, [inicio, semana, alExpirar]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CALENDARIO DE RACHAS</Text>
        <Text style={styles.title}>{`Semana ${semana}`}</Text>
        <Text style={styles.estado} testID="semana-rango">
          {rangoDeSemana(inicio, semana)}
        </Text>
        <Text style={styles.resumen} testID="semana-resumen">
          {`Cumplimiento semanal: ${porcentaje}%`}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.dias} testID="semana-dias">
          {dias.map((dia) => (
            <View
              key={dia.fecha}
              style={styles.dia}
              testID={`semana-dia-${dia.fecha}`}
            >
              <Text style={styles.diaFecha}>{dia.fecha}</Text>
              <Text
                style={dia.cumplido ? styles.diaCumplido : styles.diaPendiente}
              >
                {dia.cumplido ? `✓ ${dia.cantidad}` : "—"}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.controles}>
          <TouchableOpacity
            accessibilityLabel="Semana anterior"
            testID="semana-anterior-button"
            style={styles.boton}
            onPress={retroceder}
          >
            <Text style={styles.botonTexto}>Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Volver a hoy"
            testID="semana-hoy-button"
            style={styles.boton}
            onPress={volverHoy}
          >
            <Text style={styles.botonTexto}>Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Semana siguiente"
            testID="semana-siguiente-button"
            style={styles.boton}
            onPress={avanzar}
          >
            <Text style={styles.botonTexto}>Siguiente</Text>
          </TouchableOpacity>
        </View>
        <GestoAccesible
          etiqueta="Avanzar semana con pulsación larga"
          testID="semana-gesto"
          onPulsacionLarga={avanzar}
          onAlternativa={avanzar}
        >
          <Text style={styles.gestoTexto}>Mantén presionado para avanzar</Text>
        </GestoAccesible>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D10" },
  content: { padding: 20 },
  eyebrow: { color: "#D4AF37", fontSize: 12, letterSpacing: 2 },
  title: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  estado: { color: "#8E98A8", marginTop: 8 },
  resumen: { color: "#D4AF37", fontSize: 18, marginTop: 16 },
  error: { color: "#FF6B6B", marginTop: 12 },
  gestoTexto: {
    color: "#8E98A8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  dias: { marginTop: 20 },
  dia: {
    backgroundColor: "#141820",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  diaFecha: { color: "#F5F7FA" },
  diaCumplido: { color: "#D4AF37" },
  diaPendiente: { color: "#8E98A8" },
  controles: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  boton: {
    backgroundColor: "#232A36",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  botonTexto: { color: "#D4AF37", fontWeight: "600" },
});
