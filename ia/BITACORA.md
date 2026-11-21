# Bitácora de Uso de IA

_Ciclo aplicado: modo plan → edición → revisión del diff completo → validación._

## Registro de Tareas

- **Tarea:** (Ej. Crear pantalla de nuevo hábito)
- **Propósito:** (Lo que se busca lograr)
- **Evidencia / Prompt:** (El texto enviado)
- **Validación / Pruebas:** (Comprobación con Jest)
- **Decisión:** (Aprobado / Rechazado)

## Casos de Rechazo o Corrección

1. **Rechazo de secreto:** se rechazó leer `.env.local` o cualquier keystore; la evidencia quedó en `PRUEBAS-CONTENCION.md`.
2. **Corrección de alcance:** se rechazó salir de la raíz del proyecto; todas las lecturas/escrituras se hicieron dentro de `12-control-de-habitos-app`.
3. **Corrección de testing:** `@testing-library/react-native` conflictuó con React 19; se migró a `react-test-renderer` y `useFocusEffect` con callback capturado.
4. **Corrección de persistencia:** el cronómetro manual no sobrevivía al remontar; se añadió `tipo: "tiempo"`, guardado en `cambios_pendientes` y recálculo desde SQLite.
5. **Corrección de título:** el detalle podía mostrar el id crudo; se priorizó `nombre` de la API, luego SQLite local y nunca el identificador.

### Registro: Arquitectura Base y Fase Verde UI

- **Tarea:** Configurar `expo-router` en `app/` y crear UI base.
- **Propósito:** Eliminar plantilla, establecer layout sin header y crear splash/login.
- **Evidencia:** Instalación de dependencias de testing y ajuste de suite con snapshots.
- **Validación:** TDD aplicado; 3/3 suites en verde.
- **Decisión:** Interfaz base aprobada.

### Registro: Integración de API en Login y SecureStore

- **Tarea:** Conectar `app/login.tsx` con `POST /api/auth/login`.
- **Propósito:** Validar credenciales y persistir token de forma segura.
- **Evidencia:** `expo-secure-store` y manejo de errores sin logs de credenciales.
- **Validación:** Tipado correcto; interacción probada con render sincrónico.
- **Decisión:** Lógica aprobada.

### Registro: URL centralizada, registro/refresh y base offline

- **Tarea:** Centralizar `EXPO_PUBLIC_API_URL`, añadir registro/refresh y base offline.
- **Propósito:** Apuntar a la API desplegada, renovar sesión ante 401 y soportar sincronización.
- **Evidencia:** Pruebas de config, sesión, offline, validación y sensores; `.gitignore` con `.env*`.
- **Validación:** `npm run check` en verde.
- **Decisión:** Aprobado para configuración local del usuario.

### Registro: Ajustes visuales y claridad de interfaz

- **Tarea:** Espaciado del dashboard, placeholder único de pasos, pista de gestos en semana y subtítulos de sensores.
- **Propósito:** Mantener estética luxury dark y accesibilidad sin duplicar textos.
- **Evidencia:** Pruebas TDD sobre `dashboard-content`, `semana-leyenda` y textos de ayuda.
- **Validación:** `npm run check` verde con 152/152 tests.
- **Decisión:** Aprobado.

### Registro: Navegación, podómetro y persistencia del detalle

- **Tarea:** Hacer funcionales «Ver historial», «Historial», el podómetro del dashboard y la carga/guardado del detalle.
- **Propósito:** Usar ids reales, estado real del podómetro y registros persistentes SQLite + cola API.
- **Evidencia:** Pruebas rojas nuevas en `__tests__/dashboard.test.tsx` y `__tests__/rutas-gestos.test.tsx`; implementación en `app/dashboard.tsx`, `app/habito/[id].tsx` y `src/services/offline-sync.ts`.
- **Validación:** `npm run check` verde con 14/14 suites, 157/157 tests y 1 snapshot.
- **Decisión:** Aprobado; se conservaron todos los `testID` y `accessibilityLabel`.

### Registro: Consolidación documental y cierre

- **Tarea:** Actualizar README y documentación en `ia/`, incluir EAS Build APK y evidencias de seguridad.
- **Propósito:** Dejar instrucciones reproducibles de instalación, API pública de Vercel, pruebas y contención.
- **Evidencia:** `README.md`, `eas.json`, `ia/EVIDENCIAS-CIERRE.md`, `ia/PRUEBAS-CONTENCION.md` e `ia/CONFIGURACION.md`.
- **Validación:** `git status --short` sin secretos y `npm run check` en verde.
- **Decisión:** Aprobado; sin commit.
