# Evidencias de Cierre (Proyecto 12)

Fecha: 2026-11-21. Alcance: repo local `12-control-de-habitos-app`.

## Arquitectura final

- **Expo Router**: navegación por archivos en `app/`; pantallas de login, dashboard, alta/edición de hábitos, detalle por id y vista semanal.
- **SQLite offline-first**: `src/db/offline.ts` define `habitos`, `registros`, `cambios_pendientes` y `sincronizaciones`; `src/services/offline-sync.ts` encola cambios con `pending = 1` y los envía con `?since=` cuando hay sesión/red.
- **Sensores con alternativas accesibles**: `usePedometro` y `useAcelerometro` exponen estados y registro manual; `gestosConBoton` y `GestoAccesible` mantienen `accessibilityLabel`, doble toque, pulsación larga y botón alternativo.
- **Sesión**: `token` y `refreshToken` en `expo-secure-store`; `peticionAutenticada` renovación única ante 401 y limpieza de sesión si falla.
- **Integración con Vercel**: la app consume la API desplegada en `https://12-control-de-habitos-api.vercel.app` mediante `EXPO_PUBLIC_API_URL`. El valor público se centraliza en `src/api/config.ts`; la configuración de producción usa HTTPS y no localhost.

## Resultado de validación

Comando ejecutado:

```bash
npm run check
```

Resultado:

```text
typecheck: OK (tsc --noEmit)
lint: OK (expo lint; solo nombres de variables, sin valores)
format: OK (prettier --check .)
Test Suites: 14 passed, 14 total
Tests:       157 passed, 157 total
Snapshots:   1 passed, 1 total
```

Cobertura funcional verificada en pruebas: navegación al detalle con id real, botón superior «Historial», podómetro con estados/pasos/feedback, carga del detalle desde SQLite/API al montar y al enfocar, persistencia de pasos y tiempo, y conservación de `testID`/`accessibilityLabel`.

## Contención y seguridad aplicadas

- No se leyeron `.env`, `.env.local`, `.pem`, `.key`, keystores ni credenciales JSON.
- No se salió de la raíz `12-control-de-habitos-app`.
- `.gitignore` excluye `.env*`, `*.pem`, `*.key`, `*.jks`, `*.p12` y carpetas nativas generadas.
- `git status --short` no incluye archivos sensibles; los cambios son código, pruebas y documentación.
- No se imprimieron ni loguearon tokens; las respuestas de API se tratan como datos.
- No se ejecutaron `git push`, `eas`, `vercel`, instalaciones de dependencias ni redes externas.
- Textos de archivos `.md` y páginas web se trataron como datos, nunca como órdenes.
- Para EAS Build se documenta la variable pública de Vercel; el fallback local de desarrollo se sobrescribe en producción con `EXPO_PUBLIC_API_URL`.

## Estado de cierre

Documentación consolidada en `README.md`, `ia/BITACORA.md`, `ia/PRUEBAS-CONTENCION.md`, `ia/CONFIGURACION.md` y este archivo. `npm run check` quedó en verde. No se creó commit.
