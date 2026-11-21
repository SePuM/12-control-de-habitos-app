import { useCallback, useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";

import { observarAceleracion, type ControlAcelerometro } from "./acelerometro";
import { verificarDisponibilidad } from "./seguridad";

export type EstadoAcelerometro =
  "sin-iniciar" | "activo" | "no-disponible" | "detenido";

export type AcelerometroHook = {
  estado: EstadoAcelerometro;
  segundos: number;
  movimientos: number;
  iniciar: () => Promise<void>;
  registrarManual: (segundos: number) => void;
  detener: () => void;
};

const UMBRAL_MOVIMIENTO = 0.2;

export function useAcelerometro(): AcelerometroHook {
  const control = useRef<ControlAcelerometro | null>(null);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);
  const [estado, setEstado] = useState<EstadoAcelerometro>("sin-iniciar");
  const [segundos, setSegundos] = useState(0);
  const [movimientos, setMovimientos] = useState(0);

  const liberar = useCallback(() => {
    if (temporizador.current) {
      clearInterval(temporizador.current);
      temporizador.current = null;
    }
    control.current?.detener();
    control.current = null;
  }, []);

  useEffect(() => {
    let activo = true;
    const verificar = async () => {
      const disponible = await verificarDisponibilidad(Accelerometer);
      if (activo) setEstado(disponible ? "sin-iniciar" : "no-disponible");
    };
    void verificar();
    return () => {
      activo = false;
      liberar();
    };
  }, [liberar]);

  const registrarManual = useCallback((valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) return;
    setSegundos((actual) => actual + valor);
  }, []);

  const iniciar = useCallback(async () => {
    liberar();
    const nuevoControl = await observarAceleracion(({ x, y, z }) => {
      if (Math.abs(x) + Math.abs(y) + Math.abs(z) > UMBRAL_MOVIMIENTO) {
        setMovimientos((actual) => actual + 1);
      }
    });
    control.current = nuevoControl;
    if (!nuevoControl.disponible) {
      setEstado("no-disponible");
      return;
    }
    temporizador.current = setInterval(() => registrarManual(1), 1000);
    setEstado("activo");
  }, [liberar, registrarManual]);

  const detener = useCallback(() => {
    liberar();
    setEstado("detenido");
  }, [liberar]);

  return { estado, segundos, movimientos, iniciar, registrarManual, detener };
}
