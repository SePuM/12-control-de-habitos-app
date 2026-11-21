export const LONGITUD_NOMBRE_MINIMA = 2;
export const LONGITUD_NOMBRE_MAXIMA = 40;
export const META_PASOS_MINIMA = 500;
export const META_PASOS_MAXIMA = 50000;
export const LONGITUD_CLAVE_MINIMA = 5;
export const LONGITUD_NOMBRE_REGISTRO_MINIMA = 1;
export const LONGITUD_NOMBRE_REGISTRO_MAXIMA = 80;
export const LONGITUD_CLAVE_REGISTRO_MINIMA = 8;

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const mensajeFechaInvalida = "Fecha inválida";
const mensajeFechaFutura = "No se permiten fechas futuras";
const mensajeNombre = `El nombre debe tener entre ${LONGITUD_NOMBRE_MINIMA} y ${LONGITUD_NOMBRE_MAXIMA} caracteres`;
const mensajeMeta = "La meta de pasos debe estar entre 500 y 50.000";
const mensajeNombreRegistro = `El nombre debe tener entre ${LONGITUD_NOMBRE_REGISTRO_MINIMA} y ${LONGITUD_NOMBRE_REGISTRO_MAXIMA} caracteres`;
const mensajeCorreoRegistro = "Correo electrónico inválido";
const mensajeClaveRegistro = `La contraseña debe tener al menos ${LONGITUD_CLAVE_REGISTRO_MINIMA} caracteres`;

export const validarNombre = (valor: string): string | null => {
  const nombre = valor.trim();
  if (
    nombre.length < LONGITUD_NOMBRE_MINIMA ||
    nombre.length > LONGITUD_NOMBRE_MAXIMA
  ) {
    return mensajeNombre;
  }
  return null;
};

export const validarCredenciales = (
  correo: string,
  clave: string,
): string | null => {
  const email = correo.trim();
  const formatoValido = FORMATO_CORREO.test(email);
  if (!formatoValido || clave.length < LONGITUD_CLAVE_MINIMA) {
    return "Correo o contraseña inválidos";
  }
  return null;
};

export const validarRegistro = (
  nombre: string,
  correo: string,
  clave: string,
): string | null => {
  const nombreValido = nombre.trim();
  if (
    nombreValido.length < LONGITUD_NOMBRE_REGISTRO_MINIMA ||
    nombreValido.length > LONGITUD_NOMBRE_REGISTRO_MAXIMA
  ) {
    return mensajeNombreRegistro;
  }
  if (!FORMATO_CORREO.test(correo.trim())) {
    return mensajeCorreoRegistro;
  }
  if (clave.length < LONGITUD_CLAVE_REGISTRO_MINIMA) {
    return mensajeClaveRegistro;
  }
  return null;
};

export const validarMetaPasos = (valor: string | number): string | null => {
  const meta = Number(valor);
  if (
    !Number.isInteger(meta) ||
    meta < META_PASOS_MINIMA ||
    meta > META_PASOS_MAXIMA
  ) {
    return mensajeMeta;
  }
  return null;
};

export const validarFecha = (
  fecha: string,
  hoy: Date = new Date(),
): string | null => {
  const coincidencia = FORMATO_FECHA.exec(fecha);
  if (!coincidencia) return mensajeFechaInvalida;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const objetivo = new Date(anio, mes - 1, dia);
  const valida =
    objetivo.getFullYear() === anio &&
    objetivo.getMonth() === mes - 1 &&
    objetivo.getDate() === dia;
  if (!valida) return mensajeFechaInvalida;

  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (objetivo.getTime() > inicioHoy.getTime()) return mensajeFechaFutura;
  return null;
};
