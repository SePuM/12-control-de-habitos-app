export type SuscripcionSensor = { remove: () => void };
export type SensorDisponible = { isAvailableAsync: () => Promise<boolean> };
export type HapticDisponible = {
  isAvailableAsync?: () => Promise<boolean>;
  impactAsync: () => Promise<void> | void;
};

export type GestosAccesibles = {
  onResponderRelease: () => void;
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityRole: "button";
  onPress: () => void;
};

export const verificarDisponibilidad = async (
  sensor: SensorDisponible,
): Promise<boolean> => {
  try {
    return await sensor.isAvailableAsync();
  } catch {
    return false;
  }
};

export const crearSuscripcion = (
  disponible: boolean,
  observar: () => SuscripcionSensor,
): SuscripcionSensor | null => (disponible ? observar() : null);

export const liberarSuscripcion = (
  suscripcion: SuscripcionSensor | null,
): void => {
  suscripcion?.remove();
};

export const vibrarSiDisponible = async (
  haptics: HapticDisponible,
): Promise<void> => {
  try {
    const disponible = haptics.isAvailableAsync
      ? await haptics.isAvailableAsync()
      : true;
    if (!disponible) return;
    await haptics.impactAsync();
  } catch {
    return;
  }
};

export const gestosConBoton = (
  accion: () => void,
  etiqueta: string,
): GestosAccesibles => ({
  onResponderRelease: accion,
  accessible: true,
  accessibilityLabel: etiqueta,
  accessibilityRole: "button",
  onPress: accion,
});
