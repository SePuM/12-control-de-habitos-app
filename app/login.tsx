import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { API_BASE } from "../src/api/config";
import { guardarSesion, limpiarSesion, renovarSesion } from "../src/api/sesion";
import {
  validarCredenciales,
  validarRegistro,
} from "../src/services/validacion";

type ModoAutenticacion = "login" | "registro";

type DatosAutenticacion = {
  token?: unknown;
  refreshToken?: unknown;
  uid?: unknown;
  email?: unknown;
  nombre?: unknown;
  message?: unknown;
  error?: unknown;
  detalles?: unknown;
};

type DetalleError = { mensaje?: unknown };

const texto = (valor: unknown): string | null =>
  typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;

const esDetalle = (valor: unknown): valor is DetalleError =>
  typeof valor === "object" && valor !== null;

const mensajeDelDetalle = (detalles: unknown): string | null => {
  if (!Array.isArray(detalles)) return null;
  const primero: unknown = detalles[0];
  if (!esDetalle(primero)) return null;
  return texto(primero.mensaje);
};

const mensajeDeRegistro = (datos: DatosAutenticacion): string => {
  if (datos.error === "Datos inválidos") {
    const detalle = mensajeDelDetalle(datos.detalles);
    if (detalle) return detalle;
  }
  return texto(datos.error) ?? texto(datos.message) ?? "Error al crear cuenta";
};

const mensajeDeError = (
  datos: DatosAutenticacion,
  modo: ModoAutenticacion,
): string =>
  modo === "registro"
    ? mensajeDeRegistro(datos)
    : (texto(datos.message) ?? "Error al iniciar sesión");

const opciones = (body: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const iniciarSesion = async (
  correo: string,
  clave: string,
): Promise<string | null> => {
  const response = await fetch(
    `${API_BASE}/api/auth/login`,
    opciones({ email: correo, password: clave }),
  );
  const datos = (await response.json()) as DatosAutenticacion;

  if (response.status === 200 || response.status === 201) {
    const guardado = await guardarSesion(datos);
    return guardado ? null : "No se pudo guardar la sesión";
  }

  if (response.status === 401) {
    const renovada = await renovarSesion();
    if (!renovada) await limpiarSesion();
  }
  return mensajeDeError(datos, "login");
};

const registrar = async (
  nombre: string,
  correo: string,
  clave: string,
): Promise<string | null> => {
  const response = await fetch(
    `${API_BASE}/api/auth/registro`,
    opciones({ nombre, email: correo, password: clave }),
  );
  const datos = (await response.json()) as DatosAutenticacion;

  if (response.status !== 201) {
    return mensajeDeError(datos, "registro");
  }
  return iniciarSesion(correo, clave);
};

export default function LoginScreen() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo] = useState<ModoAutenticacion>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const alternarModo = () => {
    setError(null);
    setModo((actual) => (actual === "login" ? "registro" : "login"));
  };

  const manejarAutenticacion = async () => {
    const errorValidacion =
      modo === "registro"
        ? validarRegistro(nombre, email, password)
        : validarCredenciales(email, password);
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const errorServicio =
        modo === "registro"
          ? await registrar(nombre.trim(), email.trim(), password)
          : await iniciarSesion(email.trim(), password);
      if (errorServicio) {
        setError(errorServicio);
        return;
      }
      Alert.alert(
        "Éxito",
        modo === "registro" ? "Cuenta creada" : "Sesión iniciada",
      );
      router.replace("/dashboard");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCESO</Text>
        <Text style={styles.title}>
          {modo === "registro" ? "Crear Cuenta" : "Iniciar Sesión"}
        </Text>
        <View style={styles.card}>
          {modo === "registro" && (
            <>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                accessibilityLabel="Nombre"
                testID="nombre-input"
                placeholder="Nombre"
                placeholderTextColor="#6B7280"
                autoCapitalize="words"
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
              />
            </>
          )}
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            accessibilityLabel="Correo electrónico"
            testID="email-input"
            placeholder="Correo electrónico"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            accessibilityLabel="Contraseña"
            testID="password-input"
            placeholder="Contraseña"
            placeholderTextColor="#6B7280"
            secureTextEntry={true}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            accessibilityLabel={
              modo === "registro" ? "Crear cuenta" : "Iniciar sesión"
            }
            testID="auth-submit-button"
            style={[styles.button, loading && styles.disabledButton]}
            onPress={manejarAutenticacion}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0B0D10" />
            ) : (
              <Text style={styles.buttonText}>
                {modo === "registro" ? "Registrarse" : "Ingresar"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="cambiar-modo-button"
            style={styles.toggleButton}
            onPress={alternarModo}
            activeOpacity={0.85}
          >
            <Text style={styles.toggleText}>
              {modo === "registro"
                ? "Volver a iniciar sesión"
                : "Crear cuenta / Registrarse"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
    marginBottom: 12,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#D4AF37",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#D4AF37",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: "#0B0D10", fontSize: 16, fontWeight: "700" },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#232A36",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  toggleText: { color: "#D4AF37", fontSize: 13, fontWeight: "600" },
});
