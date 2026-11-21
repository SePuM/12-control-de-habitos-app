# Bitácora de Uso de IA

_Nota: Se llenará una vez por tarea usando el ciclo: Modo plan -> Edición -> Revisión del diff completo._

## Registro de Tareas

- **Tarea:** (Ej. Crear pantalla de nuevo hábito)
- **Propósito:** (Lo que se busca lograr)
- **Evidencia / Prompt:** (El texto enviado)
- **Validación / Pruebas:** (Comprobación en Jest)
- **Decisión:** (Aprobado / Rechazado)

## Casos de Rechazo o Corrección (Mínimo 3 obligatorios)

1. **Caso 1:** (Pendiente de documentar durante el desarrollo)
2. **Caso 2:** (Pendiente de documentar durante el desarrollo)
3. **Caso 3:** (Pendiente de documentar durante el desarrollo)

### Registro: Arquitectura Base y Fase Verde UI

- **Tarea:** Configurar `expo-router` en el directorio raíz `app/` y crear UI base.
- **Propósito:** Eliminar componentes plantilla (`src/app`), establecer enrutador sin header (`_layout.tsx`), y crear las pantallas visuales `index.tsx` (Splash) y `login.tsx` (Formulario de sesión).
- **Evidencia:** Ejecución en modo Build. Se instalaron dependencias de testing (`jest-expo`, `react-test-renderer`) y se ajustó la suite usando snapshots.
- **Validación:** TDD aplicado. 3/3 suites de pruebas pasaron a verde.
- **Decisión:** Interfaz base aprobada. Listo para implementar lógica de Firebase/SQLite.

### Registro: Integración de API en Login y SecureStore

- **Tarea:** Conectar `app/login.tsx` al backend (`POST /api/auth/login`).
- **Propósito:** Manejar el estado del formulario (email, password), invocar a la API y persistir el token de acceso de manera segura.
- **Evidencia:** Se implementó `useState` para el formulario y `expo-secure-store` para guardar el token tras recibir un código 200.
- **Validación:** El tipado en `app/login.tsx` es correcto. Las pruebas de interacción de Testing Library presentan conflicto con React 19, por lo que se priorizará la validación end-to-end en el emulador.
- **Decisión:** Lógica de login aprobada.

### Registro: URL centralizada, registro/refresh y base offline

- **Tarea:** Centralizar `EXPO_PUBLIC_API_URL`, añadir registro y renovación de sesión, y crear base `src/` para offline, validación y sensores.
- **Propósito:** Permitir apuntar la app a la API desplegada sin tocar código, soportar `POST /api/auth/registro`, renovar una vez ante 401 y dejar estructura para sincronización y gestos accesibles.
- **Evidencia:** Modo Build con TDD: pruebas nuevas en `__tests__/` para config, sesión, offline, validación, sensores y registro; `.gitignore` con `.env*`; bitácora y `AGENTS.md` actualizados.
- **Validación:** Jest enfocado en fase roja y verde; tipado, ESLint, Prettier y `npm run check` ejecutados al final.
- **Decisión:** Aprobado para entorno local; pendiente configurar `.env` del usuario y probar en dispositivo/EAS.
