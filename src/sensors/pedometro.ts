import * as Haptics from "expo-haptics";
import { Pedometer } from "expo-sensors";

import {
  crearSuscripcion,
  liberarSuscripcion,
  verificarDisponibilidad,
  vibrarSiDisponible,
} from "./seguridad";

export type ControlPedometro = {
  detener: () => void;
  disponible: boolean;
};

const sinControl = (): ControlPedometro => ({
  detener: () => undefined,
  disponible: false,
});

export const observarPasos = async (
  alCambiar: (pasos: number) => void,
): Promise<ControlPedometro> => {
  const disponible = await verificarDisponibilidad(Pedometer);
  if (!disponible) return sinControl();

  try {
    const permiso = await Pedometer.requestPermissionsAsync();
    if (!permiso.granted) return sinControl();
  } catch {
    return sinControl();
  }

  const suscripcion = crearSuscripcion(true, () =>
    Pedometer.watchStepCount(({ steps }) => alCambiar(steps)),
  );

  return {
    detener: () => {
      liberarSuscripcion(suscripcion);
      void vibrarSiDisponible(Haptics);
    },
    disponible: true,
  };
};
