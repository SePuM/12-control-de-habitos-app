# Configuración de IA - App Móvil (Proyecto 12)

## Barreras y Riesgos Cubiertos
1. **Fuga de Secretos:** Se bloqueó la lectura de archivos `**/.env*`, `*.pem`, `*.key` y keystores.
2. **Acceso al Sistema:** Se restringió a la IA de salir de la carpeta de trabajo usando un sandbox estricto (`allowRead: ["."]`, `denyRead: ["~/"]`), evitando lectura o escritura en directorios del sistema.
3. **Acciones no deseadas:** Comandos como `git push`, `npm install` o `eas build` están bloqueados o requieren permiso explícito para evitar construcciones accidentales o instalación de dependencias no verificadas.

## Límites y Ajustes Hechos
- **Inyección de Prompts:** Un permiso bloquea archivos, pero un prompt malicioso puede estar en un issue de GitHub. Se ajustó el `AGENTS.md` para que la IA trate estos textos como datos y no como órdenes.
- **Entorno local:** Como el sandbox no es nativo en Windows, se ejecutará bajo WSL2 (Ubuntu) según los requerimientos.