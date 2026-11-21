# Control de Hábitos — Proyecto 12

App móvil hecha con Expo, React Native y TypeScript. Usa Expo Router para navegación, SQLite para operación offline-first y una API pública desplegada en Vercel.

## Requisitos

- Node.js 20 LTS y npm.
- Expo Go, emulador Android o dispositivo físico para probar la app.
- Cuenta de Expo/EAS solo si se desea generar un APK.

## Instalación

```bash
npm install
```

## Configuración de la API

Crea un archivo `.env` local en la raíz del proyecto con la URL pública de la API:

```env
EXPO_PUBLIC_API_URL=https://12-control-de-habitos-api.vercel.app
```

- `EXPO_PUBLIC_API_URL` es una variable pública: no contiene secretos.
- `.env*` está ignorado por Git; nunca lo subas al repositorio.
- Para desarrollo local puedes apuntar a otra URL, pero las builds de producción deben usar la URL HTTPS de Vercel. Así se evita localhost o IP privada en producción.

## Ejecución

```bash
npx expo start
```

Desde el menú de Expo puedes abrir la app en Expo Go, emulador Android o simulador iOS.

## Pruebas y calidad

La compuerta única es:

```bash
npm run check
```

Este comando ejecuta, en orden:

- `npm run typecheck` — TypeScript sin errores.
- `npm run lint` — ESLint de Expo.
- `npm run format:check` — Prettier.
- `npm test` — Jest con `react-test-renderer`.

Estado vigente: `14/14` suites, `157/157` tests y `1/1` snapshot en verde.

## Arquitectura

- `app/`: pantallas y rutas con Expo Router (`login`, `dashboard`, `semana`, `habito/nuevo`, `habito/editar`, `habito/[id]`).
- `src/api/`: base URL centralizada y sesión con refresh automático ante 401.
- `src/db/` y `src/services/offline-sync.ts`: SQLite offline-first con tablas para hábitos, registros, cambios pendientes y última sincronización.
- `src/sensors/`: podómetro y acelerómetro con alternativas manuales y accesibles.
- `src/components/`: gestos accesibles con doble toque, pulsación larga y botón alternativo.

Los tokens de acceso se guardan en `expo-secure-store` bajo `token` y `refreshToken`; no se imprimen en consola ni se versionan.

## Generar APK con EAS Build

El perfil `apk` de `eas.json` genera un archivo `.apk` para Android:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile apk
```

Cuando EAS termine, descarga el APK desde el panel de la build. No ejecutes `eas build`, `git push` ni despliegues sin permiso explícito.

## Evidencias y bitácora

La documentación de decisiones, contención y validación está en `ia/BITACORA.md`, `ia/PRUEBAS-CONTENCION.md`, `ia/CONFIGURACION.md` e `ia/EVIDENCIAS-CIERRE.md`.

## APK de Android (EAS Build)
- **Enlace de compilación y descarga:** https://expo.dev/accounts/sepum/projects/12-control-de-habitos-app/builds/3d5ca5d8-e782-4c8d-9203-43716abb9d31
