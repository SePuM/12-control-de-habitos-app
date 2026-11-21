import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { gestosConBoton } from "../../src/sensors/seguridad";
import { usePedometro } from "../../src/sensors/use-pedometro";

export default function LoadingScreen() {
  const router = useRouter();
  const pedometro = usePedometro();

  useEffect(() => {
    let activo = true;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const resolverRuta = async () => {
      let conSesion = false;
      try {
        conSesion = Boolean(await SecureStore.getItemAsync("token"));
      } catch {
        conSesion = false;
      }
      if (!activo) return;
      temporizador = setTimeout(() => {
        if (activo) router.replace(conSesion ? "/dashboard" : "/login");
      }, 0);
    };

    void resolverRuta();

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [router]);

  const accesoHabitos = gestosConBoton(
    () => router.push("/dashboard"),
    "Ir a mis hábitos",
  );
  const accesoPedometro = gestosConBoton(
    () => void pedometro.iniciar(),
    "Iniciar podómetro",
  );

  return (
    <View style={styles.container}>
      <Text>Cargando sesión...</Text>
      <Text style={styles.estado}>{`Podómetro: ${pedometro.estado}`}</Text>
      <TouchableOpacity
        {...accesoHabitos}
        testID="ir-habitos-button"
        style={styles.boton}
      >
        <Text style={styles.botonTexto}>Ir a mis hábitos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        {...accesoPedometro}
        testID="iniciar-pedometro-index"
        style={styles.boton}
      >
        <Text style={styles.botonTexto}>Iniciar podómetro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0D10",
  },
  estado: { color: "#8E98A8", marginTop: 12 },
  boton: {
    backgroundColor: "#232A36",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  botonTexto: { color: "#D4AF37", fontWeight: "600" },
});
