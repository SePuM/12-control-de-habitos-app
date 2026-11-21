import { Accelerometer } from "expo-sensors";

import {
  crearSuscripcion,
  liberarSuscripcion,
  verificarDisponibilidad,
} from "./seguridad";

export type Aceleracion = { x: number; y: number; z: number };
export type ControlAcelerometro = {
  detener: () => void;
  disponible: boolean;
};

const sinControl = (): ControlAcelerometro => ({
  detener: () => undefined,
  disponible: false,
});

export const observarAceleracion = async (
  alCambiar: (aceleracion: Aceleracion) => void,
): Promise<ControlAcelerometro> => {
  const disponible = await verificarDisponibilidad(Accelerometer);
  if (!disponible) return sinControl();

  const suscripcion = crearSuscripcion(true, () =>
    Accelerometer.addListener((aceleracion) => {
      alCambiar({
        x: aceleracion.x,
        y: aceleracion.y,
        z: aceleracion.z,
      });
    }),
  );

  return {
    detener: () => liberarSuscripcion(suscripcion),
    disponible: true,
  };
};
