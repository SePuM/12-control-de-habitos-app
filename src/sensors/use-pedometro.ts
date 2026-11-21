import { useCallback, useEffect, useRef, useState } from "react";

import { observarPasos, type ControlPedometro } from "./pedometro";

export type EstadoPedometro =
  "sin-iniciar" | "iniciando" | "activo" | "no-disponible" | "detenido";

export type PedometroHook = {
  estado: EstadoPedometro;
  pasos: number;
  iniciar: () => Promise<void>;
  registrarManual: (pasos: number) => void;
  detener: () => void;
};

export function usePedometro(): PedometroHook {
  const control = useRef<ControlPedometro | null>(null);
  const [estado, setEstado] = useState<EstadoPedometro>("sin-iniciar");
  const [pasos, setPasos] = useState(0);

  const liberar = useCallback(() => {
    control.current?.detener();
    control.current = null;
  }, []);

  useEffect(() => liberar, [liberar]);

  const iniciar = useCallback(async () => {
    liberar();
    setEstado("iniciando");
    const nuevoControl = await observarPasos((valor) => setPasos(valor));
    control.current = nuevoControl;
    setEstado(nuevoControl.disponible ? "activo" : "no-disponible");
  }, [liberar]);

  const registrarManual = useCallback((valor: number) => {
    setPasos(valor);
  }, []);

  const detener = useCallback(() => {
    liberar();
    setEstado("detenido");
  }, [liberar]);

  return { estado, pasos, iniciar, registrarManual, detener };
}
