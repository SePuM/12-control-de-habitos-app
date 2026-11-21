import React, { useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams, useRouter } from "expo-router";

import { API_BASE } from "../../src/api/config";
import { peticionAutenticada } from "../../src/api/sesion";
import {
  confirmarCambioOffline,
  registrarCambioOffline,
  type EntradaCambioOffline,
} from "../../src/services/offline-sync";
import { validarNombre } from "../../src/services/validacion";

const encolarCambio = async (
  entrada: EntradaCambioOffline,
): Promise<string | null> => {
  try {
    const cambio = await registrarCambioOffline(entrada);
    return cambio.id;
  } catch {
    return null;
  }
};

const confirmarCambio = async (id: string | null): Promise<void> => {
  if (!id) return;
  try {
    await confirmarCambioOffline(id);
  } catch {
    return;
  }
};

const textoDeParametro = (valor: unknown): string => {
  if (typeof valor === "string") {
    return valor;
  }
  if (Array.isArray(valor)) {
    const primero: unknown = valor[0];
    return typeof primero === "string" ? primero : "";
  }
  return "";
};

export default function EditarHabitoScreen() {
  const parametros = useLocalSearchParams();
  const id = textoDeParametro(parametros.id);
  const tipo = textoDeParametro(parametros.tipo) || "manual";
  const activo = textoDeParametro(parametros.activo) !== "false";
  const [nombre, setNombre] = useState(() =>
    textoDeParametro(parametros.nombre),
  );
  const [meta, setMeta] = useState(() => textoDeParametro(parametros.meta));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const guardar = async () => {
    const nombreLimpio = nombre.trim();
    const metaNumero = Number(meta);

    if (!nombreLimpio) {
      setError("El nombre es obligatorio");
      return;
    }
    const errorNombre = validarNombre(nombreLimpio);
    if (errorNombre) {
      setError(errorNombre);
      return;
    }
    if (!Number.isInteger(metaNumero) || metaNumero < 1) {
      setError("La meta debe ser un entero mayor o igual a 1");
      return;
    }
    if (!id) {
      setError("No se pudo guardar el hábito");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idCambio = await encolarCambio({
        entidad: "habito",
        operacion: "actualizar",
        datos: {
          id,
          remote_id: id,
          nombre: nombreLimpio,
          tipo,
          meta: metaNumero,
          activo,
          deleted: false,
        },
      });
      const token = await SecureStore.getItemAsync("token");
      const response = await peticionAutenticada(
        `${API_BASE}/api/habito/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nombre: nombreLimpio,
            tipo,
            meta: metaNumero,
            activo,
          }),
        },
        () => router.replace("/login"),
      );

      if (response.status === 200 || response.status === 201) {
        await confirmarCambio(idCambio);
        router.replace("/dashboard");
      } else {
        setError("No se pudo guardar el hábito");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>EDITAR REGISTRO</Text>
        <Text style={styles.title}>Editar Hábito</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Nombre del hábito</Text>
          <TextInput
            testID="nombre-input"
            placeholder="Nombre del hábito"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
          />
          <Text style={styles.label}>Meta diaria</Text>
          <TextInput
            testID="meta-input"
            placeholder="Meta diaria"
            placeholderTextColor="#6B7280"
            keyboardType="number-pad"
            style={styles.input}
            value={meta}
            onChangeText={setMeta}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            testID="guardar-button"
            style={[styles.button, loading && styles.disabledButton]}
            onPress={guardar}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0B0D10" />
            ) : (
              <Text style={styles.buttonText}>Guardar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="cancelar-button"
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D10" },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  eyebrow: {
    color: "#8E98A8",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#141820",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#232A36",
    padding: 20,
  },
  label: {
    color: "#8E98A8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0F131A",
    borderWidth: 1,
    borderColor: "#232A36",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#F5F7FA",
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#D4AF37",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: "#0B0D10", fontSize: 16, fontWeight: "700" },
  cancelButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#232A36",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  cancelText: { color: "#8E98A8", fontSize: 15, fontWeight: "600" },
});
