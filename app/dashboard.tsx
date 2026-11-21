import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useRouter } from "expo-router";

import { API_BASE } from "../src/api/config";
import { peticionAutenticada } from "../src/api/sesion";
import GestoAccesible from "../src/components/gesto-accesible";
import {
  confirmarCambioOffline,
  guardarHabilidadesLocales,
  leerHabilidadesLocales,
  registrarCambioOffline,
  sincronizarCambios,
  type EntradaCambioOffline,
} from "../src/services/offline-sync";
import { gestosConBoton } from "../src/sensors/seguridad";
import { usePedometro } from "../src/sensors/use-pedometro";

export const fechaLocal = (): string => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

type Habito = {
  id?: string;
  _id?: string;
  nombre: string;
  racha?: number;
  rachaActual?: number;
  racha_actual?: number;
  meta?: number;
  tipo?: string;
  activo?: boolean;
};

type Registro = {
  habitoId?: string;
  habito_id?: string;
  idHabito?: string;
  deleted_at?: string | null;
};

type Estadistica = {
  habito_id?: string;
  racha_actual?: number;
};

const capitalizar = (texto: string): string =>
  texto.charAt(0).toUpperCase() + texto.slice(1);

const rachaDe = (habito: Habito): number =>
  habito.racha ?? habito.rachaActual ?? habito.racha_actual ?? 0;

const idsDeRegistros = (registros: Registro[]): string[] =>
  registros
    .filter((registro) => registro.deleted_at == null)
    .map(
      (registro) =>
        registro.habitoId ?? registro.habito_id ?? registro.idHabito,
    )
    .filter((id): id is string => Boolean(id));

const idDe = (habito: Habito): string => habito.id ?? habito._id ?? "";

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

const esEstadistica = (valor: unknown): valor is Estadistica =>
  typeof valor === "object" && valor !== null;

const listaDeEstadisticas = (data: unknown): Estadistica[] => {
  if (Array.isArray(data)) {
    return data.filter(esEstadistica);
  }
  if (!esEstadistica(data)) {
    return [];
  }
  const contenedor = data as {
    estadisticas?: unknown;
    rachas?: unknown;
  };
  const lista = contenedor.estadisticas ?? contenedor.rachas;
  return Array.isArray(lista) ? lista.filter(esEstadistica) : [];
};

const numeroValido = (valor: unknown): number | null =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : null;

const rachasDeEstadisticas = (data: unknown): Map<string, number> => {
  const rachas = new Map<string, number>();
  listaDeEstadisticas(data).forEach((estadistica) => {
    const id = estadistica.habito_id;
    const racha = numeroValido(estadistica.racha_actual);
    if (typeof id === "string" && racha !== null) {
      rachas.set(id, racha);
    }
  });
  return rachas;
};

const useHabitos = () => {
  const router = useRouter();
  const pedometro = usePedometro();
  const alExpirar = useCallback(() => {
    router.replace("/login");
  }, [router]);
  const [habitos, setHabitos] = useState<Habito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [rachas, setRachas] = useState<Map<string, number>>(new Map());

  const cargarLocales = useCallback(async () => {
    try {
      const locales = await leerHabilidadesLocales();
      setHabitos(locales);
      if (locales.length > 0) setError(null);
      else setError("Error de conexión");
    } catch {
      setError("Error de conexión");
    }
  }, []);

  const sincronizarPendientes = useCallback(async () => {
    try {
      await sincronizarCambios();
    } catch {
      return;
    }
  }, []);

  const persistirHabitos = useCallback(async (datos: Habito[]) => {
    try {
      await guardarHabilidadesLocales(datos);
    } catch {
      return;
    }
  }, []);

  const cargarRachas = useCallback(
    async (headers: { Authorization: string }) => {
      try {
        const response = await peticionAutenticada(
          `${API_BASE}/api/registro_habito/estadisticas?fecha=${fechaLocal()}`,
          { method: "GET", headers },
          alExpirar,
        );
        if (response.status === 200) {
          setRachas(rachasDeEstadisticas(await response.json()));
          return;
        }
      } catch {
        setRachas(new Map());
        return;
      }
      setRachas(new Map());
    },
    [alExpirar],
  );

  const fetchHabitos = useCallback(async () => {
    try {
      await sincronizarPendientes();
      const token = await SecureStore.getItemAsync("token");
      const headers = { Authorization: `Bearer ${token}` };
      const response = await peticionAutenticada(
        `${API_BASE}/api/habito`,
        { method: "GET", headers },
        alExpirar,
      );

      if (response.status !== 200) {
        setError("Error al cargar hábitos");
        return;
      }

      const data = (await response.json()) as Habito[];
      setHabitos(data);
      setError(null);
      await persistirHabitos(data);

      try {
        const registrosResponse = await peticionAutenticada(
          `${API_BASE}/api/registro_habito?fecha=${fechaLocal()}`,
          { method: "GET", headers },
          alExpirar,
        );
        if (registrosResponse.status === 200) {
          const registros = (await registrosResponse.json()) as Registro[];
          setCompletados(new Set(idsDeRegistros(registros)));
        }
      } catch {
        setCompletados(new Set());
      }
      await cargarRachas(headers);
    } catch {
      await cargarLocales();
    } finally {
      setLoading(false);
    }
  }, [
    cargarRachas,
    cargarLocales,
    persistirHabitos,
    sincronizarPendientes,
    alExpirar,
  ]);

  const alternar = useCallback(
    async (habito: Habito, marcado: boolean) => {
      const id = habito.id ?? habito._id;
      if (!id) return;

      setCompletados((actuales) => {
        const siguientes = new Set(actuales);
        if (marcado) siguientes.delete(id);
        else siguientes.add(id);
        return siguientes;
      });
      setErrorAccion(null);
      const idCambio = await encolarCambio({
        entidad: "registro",
        operacion: marcado ? "eliminar" : "crear",
        datos: {
          habitoId: id,
          fecha: fechaLocal(),
          cantidad: habito.meta ?? 1,
          remote_id: id,
          deleted: marcado,
        },
      });

      try {
        const token = await SecureStore.getItemAsync("token");
        const url = `${API_BASE}/api/registro_habito/${id}/${fechaLocal()}`;
        const response = marcado
          ? await peticionAutenticada(
              url,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
              alExpirar,
            )
          : await peticionAutenticada(
              url,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ cantidad: habito.meta ?? 1 }),
              },
              alExpirar,
            );

        if (
          response.status !== 200 &&
          response.status !== 201 &&
          response.status !== 204
        ) {
          throw new Error("Respuesta inesperada");
        }
        void cargarRachas({ Authorization: `Bearer ${token}` });
        await confirmarCambio(idCambio);
      } catch {
        setCompletados((actuales) => {
          const siguientes = new Set(actuales);
          if (marcado) siguientes.add(id);
          else siguientes.delete(id);
          return siguientes;
        });
        setErrorAccion("No se pudo actualizar el registro");
      }
    },
    [cargarRachas, alExpirar],
  );

  const eliminar = useCallback(
    async (habito: Habito) => {
      const id = idDe(habito);
      if (!id) return;

      const habitosPrevios = habitos;
      const completadosPrevios = completados;
      const rachasPrevias = rachas;

      setHabitos((actuales) => actuales.filter((item) => idDe(item) !== id));
      setCompletados(() => {
        const siguientes = new Set(completadosPrevios);
        siguientes.delete(id);
        return siguientes;
      });
      setRachas(() => {
        const siguientes = new Map(rachasPrevias);
        siguientes.delete(id);
        return siguientes;
      });
      setErrorAccion(null);
      const idCambio = await encolarCambio({
        entidad: "habito",
        operacion: "eliminar",
        datos: {
          id,
          remote_id: id,
          deleted: true,
          updated_at: new Date().toISOString(),
        },
      });

      try {
        const token = await SecureStore.getItemAsync("token");
        const response = await peticionAutenticada(
          `${API_BASE}/api/habito/${id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
          alExpirar,
        );
        if (
          response.status !== 200 &&
          response.status !== 201 &&
          response.status !== 204
        ) {
          throw new Error("Respuesta inesperada");
        }
        await confirmarCambio(idCambio);
      } catch {
        setHabitos(habitosPrevios);
        setCompletados(completadosPrevios);
        setRachas(rachasPrevias);
        setErrorAccion("No se pudo eliminar el hábito");
      }
    },
    [habitos, completados, rachas, alExpirar],
  );

  useFocusEffect(
    useCallback(() => {
      fetchHabitos();
    }, [fetchHabitos]),
  );

  return {
    habitos,
    loading,
    error,
    completados,
    alternar,
    eliminar,
    errorAccion,
    rachas,
    pedometro,
  };
};

type TarjetaProps = {
  habito: Habito;
  completado: boolean;
  racha: number;
  onToggle: (habito: Habito, marcado: boolean) => void;
  onEditar: (habito: Habito) => void;
  onEliminar: (habito: Habito) => void;
};

function AccionesHabito({
  habito,
  completado,
  racha,
  onToggle,
  onEditar,
  onEliminar,
}: TarjetaProps) {
  const id = idDe(habito);

  return (
    <View style={styles.cardAcciones}>
      <View style={styles.badge}>
        <Text testID={`racha-${id}`} style={styles.badgeText}>
          Racha: {racha}
        </Text>
      </View>
      <GestoAccesible
        etiqueta={
          completado ? `Desmarcar ${habito.nombre}` : `Marcar ${habito.nombre}`
        }
        testID={`gesto-marcar-${id}`}
        onDobleToque={() => onToggle(habito, completado)}
        onPulsacionLarga={() => onToggle(habito, completado)}
        onAlternativa={() => onToggle(habito, completado)}
      >
        <TouchableOpacity
          accessibilityLabel={
            completado
              ? `Desmarcar ${habito.nombre}`
              : `Marcar ${habito.nombre}`
          }
          testID={`marcar-${id}`}
          style={[styles.checkButton, completado && styles.checkButtonActivo]}
          onPress={() => onToggle(habito, completado)}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.checkText, completado && styles.checkTextActivo]}
          >
            {completado ? "Hecho ✓" : "Marcar"}
          </Text>
        </TouchableOpacity>
      </GestoAccesible>
      <View style={styles.accionesSecundarias}>
        <TouchableOpacity
          accessibilityLabel={`Editar ${habito.nombre}`}
          testID={`editar-${id}`}
          style={styles.accionBoton}
          onPress={() => onEditar(habito)}
          activeOpacity={0.85}
        >
          <Text style={styles.accionEditarTexto}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={`Eliminar ${habito.nombre}`}
          testID={`eliminar-${id}`}
          style={styles.accionBoton}
          onPress={() => onEliminar(habito)}
          activeOpacity={0.85}
        >
          <Text style={styles.accionEliminarTexto}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HabitoCard(props: TarjetaProps) {
  const { habito } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardNombre}>{capitalizar(habito.nombre)}</Text>
        <Text style={styles.cardMeta}>Diario · Meta {habito.meta ?? 1}</Text>
      </View>
      <AccionesHabito {...props} />
    </View>
  );
}

function ModalConfirmacion({
  habito,
  onCancelar,
  onConfirmar,
}: {
  habito: Habito;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const id = idDe(habito);

  return (
    <Modal
      testID="modal-confirmacion"
      visible
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.modalFondo}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitulo}>Eliminar hábito</Text>
          <Text style={styles.modalTexto}>
            ¿Eliminar {capitalizar(habito.nombre)}?
          </Text>
          <View style={styles.modalAcciones}>
            <TouchableOpacity
              accessibilityLabel="Cancelar eliminación"
              testID={`cancelar-eliminar-${id}`}
              style={[styles.modalBoton, styles.modalBotonCancelar]}
              onPress={onCancelar}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBotonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Confirmar eliminación"
              testID={`confirmar-eliminar-${id}`}
              style={[styles.modalBoton, styles.modalBotonEliminar]}
              onPress={onConfirmar}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBotonTexto}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BotonCerrarSesion({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityLabel="Cerrar sesión"
      testID="cerrar-sesion-button"
      style={styles.logoutButton}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.logoutText}>Cerrar sesión</Text>
    </TouchableOpacity>
  );
}

function EstadoCentrado({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.centered}>{children}</View>
    </View>
  );
}

export default function DashboardScreen() {
  const {
    habitos,
    loading,
    error,
    completados,
    alternar,
    eliminar,
    errorAccion,
    rachas,
    pedometro,
  } = useHabitos();
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<Habito | null>(null);

  const abrirEdicion = (habito: Habito) => {
    router.push({
      pathname: "/habito/editar",
      params: {
        id: idDe(habito),
        nombre: habito.nombre,
        meta: String(habito.meta ?? 1),
        tipo: habito.tipo ?? "manual",
        activo: String(habito.activo ?? true),
      },
    });
  };

  const confirmarEliminacion = () => {
    const habito = confirmando;
    setConfirmando(null);
    if (habito) void eliminar(habito);
  };

  const cerrarSesion = async () => {
    try {
      await SecureStore.deleteItemAsync("token");
    } finally {
      router.replace("/login");
    }
  };

  if (loading) {
    return (
      <EstadoCentrado>
        <ActivityIndicator
          testID="loading-indicator"
          size="large"
          color="#D4AF37"
        />
      </EstadoCentrado>
    );
  }

  if (error) {
    return (
      <EstadoCentrado>
        <Text style={styles.error}>{error}</Text>
      </EstadoCentrado>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content} testID="dashboard-content">
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.eyebrow}>CONTROL DIARIO</Text>
            <BotonCerrarSesion onPress={cerrarSesion} />
          </View>
          <Text style={styles.title}>Mis Hábitos</Text>
          <Text style={styles.counter}>
            {habitos.length}{" "}
            {habitos.length === 1 ? "hábito activo" : "hábitos activos"}
          </Text>
          <View style={styles.navRow}>
            <TouchableOpacity
              accessibilityLabel="Ver vista semanal"
              testID="ver-semana-button"
              style={styles.navBoton}
              onPress={() => router.push("/semana")}
            >
              <Text style={styles.navTexto}>Semana</Text>
            </TouchableOpacity>
            {habitos.length > 0 && (
              <TouchableOpacity
                accessibilityLabel="Ver historial del primer hábito"
                testID="ver-detalle-button"
                style={styles.navBoton}
                onPress={() =>
                  router.push(
                    `/habito/${idDe(habitos[0])}` as Parameters<
                      typeof router.push
                    >[0],
                  )
                }
              >
                <Text style={styles.navTexto}>Historial</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={styles.pasosTexto}
          >{`Pasos de hoy: ${pedometro.pasos}`}</Text>
          <TouchableOpacity
            {...gestosConBoton(
              () => void pedometro.iniciar(),
              "Iniciar podómetro",
            )}
            testID="iniciar-pedometro-dashboard"
            style={styles.navBoton}
          >
            <Text style={styles.navTexto}>Podómetro</Text>
          </TouchableOpacity>
        </View>
        {errorAccion && <Text style={styles.error}>{errorAccion}</Text>}
        <FlatList
          data={habitos}
          keyExtractor={(item, index) => item.id ?? item._id ?? String(index)}
          renderItem={({ item }) => {
            const id = idDe(item);
            return (
              <HabitoCard
                habito={item}
                completado={completados.has(id)}
                racha={rachas.get(id) ?? rachaDe(item)}
                onToggle={alternar}
                onEditar={abrirEdicion}
                onEliminar={setConfirmando}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Aún no tienes hábitos. ¡Crea el primero!
              </Text>
            </View>
          }
        />
        <TouchableOpacity
          accessibilityLabel="Crear nuevo hábito"
          testID="nuevo-habito-button"
          style={styles.button}
          onPress={() => router.push("/habito/nuevo")}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>+ Nuevo Hábito</Text>
        </TouchableOpacity>
        {confirmando && (
          <ModalConfirmacion
            habito={confirmando}
            onCancelar={() => setConfirmando(null)}
            onConfirmar={confirmarEliminacion}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D10" },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: { marginBottom: 20 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  logoutButton: {
    backgroundColor: "#141820",
    borderColor: "#232A36",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { color: "#D4AF37", fontSize: 12, fontWeight: "600" },
  eyebrow: {
    color: "#8E98A8",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: { color: "#F5F7FA", fontSize: 30, fontWeight: "700" },
  counter: { color: "#8E98A8", fontSize: 13, marginTop: 6 },
  navRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  navBoton: {
    backgroundColor: "#232A36",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  navTexto: { color: "#D4AF37", fontSize: 13, fontWeight: "600" },
  pasosTexto: { color: "#8E98A8", fontSize: 13, marginTop: 12 },
  listContent: { paddingBottom: 8, flexGrow: 1 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    padding: 18,
    backgroundColor: "#141820",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#232A36",
  },
  cardInfo: { flex: 1, paddingRight: 12 },
  cardNombre: { color: "#F5F7FA", fontSize: 17, fontWeight: "600" },
  cardMeta: { color: "#8E98A8", fontSize: 13, marginTop: 4 },
  cardAcciones: { alignItems: "flex-end" },
  badge: {
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: "#D4AF37", fontSize: 13, fontWeight: "700" },
  checkButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#232A36",
  },
  checkButtonActivo: {
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    borderColor: "#D4AF37",
  },
  checkText: { color: "#8E98A8", fontSize: 12, fontWeight: "600" },
  checkTextActivo: { color: "#D4AF37" },
  accionesSecundarias: { flexDirection: "row", gap: 8, marginTop: 8 },
  accionBoton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232A36",
  },
  accionEditarTexto: { color: "#D4AF37", fontSize: 11, fontWeight: "600" },
  accionEliminarTexto: { color: "#FF6B6B", fontSize: 11, fontWeight: "600" },
  modalFondo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(11, 13, 16, 0.85)",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#141820",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#232A36",
    padding: 20,
  },
  modalTitulo: { color: "#F5F7FA", fontSize: 18, fontWeight: "700" },
  modalTexto: { color: "#8E98A8", fontSize: 14, marginTop: 10 },
  modalAcciones: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalBoton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBotonCancelar: { borderColor: "#232A36" },
  modalBotonEliminar: { backgroundColor: "#D4AF37", borderColor: "#D4AF37" },
  modalBotonTexto: { color: "#F5F7FA", fontSize: 13, fontWeight: "700" },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#141820",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#232A36",
    borderStyle: "dashed",
  },
  emptyText: { color: "#8E98A8", fontSize: 15, textAlign: "center" },
  error: { color: "#FF6B6B", fontSize: 14, textAlign: "center" },
  button: {
    backgroundColor: "#D4AF37",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonText: { color: "#0B0D10", fontSize: 16, fontWeight: "700" },
});
