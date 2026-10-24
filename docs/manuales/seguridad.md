# 4.5 Manual de Seguridad — SecureHub / VulnTrack

*Modelo de amenazas, herramientas DevSecOps y gestión de vulnerabilidades*

| Campo | Valor |
| --- | --- |
| **Proyecto** | SecureHub / VulnTrack |
| **Versión documental** | 1.0 — 20 de octubre de 2026 |
| **Licencia** | MIT (`LICENSE`) |

---

## 1. Objetivo

Documentar los controles de seguridad que se identifican en el código y la automatización de VulnTrack/SecureHub, la forma de ejecutar o revisar análisis y el proceso de tratamiento de hallazgos. Los reportes reales deben adjuntarse al finalizar cada análisis; este manual no declara resultados que no se hayan aportado.

---

## 2. Activos y límites de confianza

* Credenciales, hashes de contraseña, secreto MFA/TOTP y tokens de sesión.
* Datos multiempresa: usuarios, roles, activos, vulnerabilidades, riesgos, planes de remediación y evidencias.
* Base de datos PostgreSQL y políticas de aislamiento por empresa (RLS descrito en `README.md` y esquema).
* API REST y frontend; Redis usado para rate limiting y estado/caché.
* Archivos de evidencia, logs, configuración de monitoreo y secretos de integración.
* Fuentes externas: NVD/NIST y SMTP, cuando se configuren.

---

## 3. Modelo de amenazas

El repositorio incluye `security/threat-model.json`. El siguiente resumen es una guía de lectura basada en los componentes y controles descritos por el proyecto; se debe contrastar con el contenido vigente del archivo y los resultados de pruebas.

| Amenaza | Impacto potencial | Controles descritos / medidas recomendadas |
| --- | --- | --- |
| Acceso no autorizado o escalamiento de privilegios | Exposición o modificación de información de empresas | JWT, middleware de permisos/RBAC dinámico, RLS; probar rutas por rol. |
| Fuerza bruta contra login | Compromiso de cuentas | Rate limiting apoyado en Redis; verificar límites, respuestas y registros. |
| Inyección SQL | Lectura/modificación no autorizada | Consultas parametrizadas según README; validar con análisis estático y pruebas. |
| Fuga de secretos | Compromiso de cuentas, servicios o datos | Gitleaks, `.gitignore`, variables de entorno; rotar secretos expuestos. |
| Dependencias o imágenes vulnerables | Ejecución de código o escalamiento | Trivy y actualización controlada de dependencias/imágenes. |
| Ataques a la aplicación web/API | Exposición de datos o abuso de endpoints | OWASP ZAP en el workflow DAST; probar en staging autorizado. |
| Pérdida o alteración de datos | Interrupción y pérdida de trazabilidad | Volúmenes persistentes, backups y pruebas de restauración pendientes de formalizar. |
| Abuso de consolas de monitoreo | Exposición de métricas/logs o cambios de configuración | Restringir puertos y credenciales; no exponer consolas públicamente sin hardening. |

---

## 4. Controles identificados en el proyecto

* Autenticación basada en JWT y contraseñas procesadas con `bcryptjs` según la documentación del proyecto.
* MFA/TOTP compatible con aplicaciones autenticadoras.
* Permisos dinámicos y middleware de autorización; aislamiento multiempresa descrito mediante Row-Level Security (RLS).
* `helmet`, lista de orígenes CORS, límite de payload JSON (`10kb`) y limitación de intentos de inicio de sesión descritos en `README.md`.
* Tabla de eventos de auditoría descrita como append-only en la documentación; confirmar restricciones reales en la base de datos antes de considerarla inmutable.
* GitHub Actions: workflows para pruebas backend, seguridad DevSecOps y seguridad de infraestructura.

---

## 5. Herramientas de seguridad y configuración observada

| Herramienta | Uso identificado | Observación |
| --- | --- | --- |
| **Gitleaks** | Detección de secretos en workflow DevSecOps y pre-commit | Revisar hallazgos y confirmar que los secretos no están activos; la supresión no reemplaza rotación. |
| **Semgrep** | SAST con configuración `auto` sobre `backend` y `frontend` | El workflow usa `semgrep scan --config auto --error`. |
| **Trivy** | Escaneo de archivos/dependencias y análisis de imagen en CI; scanner propio con Trivy | El workflow excluye rutas de dependencias/build indicadas en YAML. |
| **OWASP ZAP** | DAST de API de staging con reportes HTML y JSON | El workflow genera `zap-dast-report.html` y `zap-dast-report.json`. |
| **Jest + Supertest** | Pruebas automatizadas de backend | Hay pruebas en `backend/tests` y workflow de ejecución. |
| **Bandit** | No se encontró configuración o ejecución de Bandit en los workflows revisados | No afirmar que Bandit está implementado. Aplicaría si se incorpora código Python (en Node.js/React se usa Semgrep + ESLint Security). |
| **Checkov** | Revisión de IaC/infraestructura indicada por workflow de seguridad de infraestructura | Verificar resultados y configuración exacta en el workflow. |

---

## 6. Ejecución de pruebas y análisis

### 6.1 Pruebas de backend

```powershell
cd backend
npm ci
npm test -- --ci
```

El workflow ejecuta `npm ci` y `npm test -- --ci`. Guardar el log del job de GitHub Actions como evidencia.

### 6.2 Gitleaks

El workflow incluye la acción `gitleaks/gitleaks-action@v3` y el repositorio cuenta con `.pre-commit-config.yaml`. Para interpretar el resultado, distinguir secretos reales de falsos positivos; cualquier credencial expuesta debe revocarse/rotarse aunque se elimine del historial.

### 6.3 Semgrep

```bash
semgrep scan --config auto --error --exclude 'backend/zap-reports/**' backend frontend
```

El comando corresponde al workflow de CI; requiere tener Semgrep instalado o ejecutar el job automatizado. Revisar regla, archivo, línea, severidad y evidencia del flujo.

### 6.4 Trivy

El workflow DevSecOps incluye un job Trivy y excluye rutas como `node_modules`, `frontend/dist`, reportes ZAP y carpetas de agentes. El scanner también se construye desde `./scanner` y utiliza Trivy. Los hallazgos deben asociarse al componente, CVE, severidad, versión afectada y versión corregida.

```powershell
docker compose logs --tail=200 securehub-scanner
```

El comando permite revisar el contenedor scanner. La ruta del último JSON se define en Compose como `/var/logs/scanner/scanner/latest.json` dentro del volumen del scanner; la ubicación en el host depende del montaje y del volumen. No se debe asumir que existe un reporte hasta comprobarlo.

### 6.5 OWASP ZAP

El workflow ejecuta un escaneo DAST de la API de staging con `zap-api-scan.py` y publica los reportes HTML/JSON como artefactos. Ejecutar pruebas activas únicamente contra entornos propios o autorizados:

* Confirmar que staging está levantado y que el target corresponde al entorno aprobado.
* Descargar el artefacto `vulntrack-zap-dast-report` y revisar alertas por riesgo, URL, parámetro, evidencia y solución sugerida.
* Un código de salida no cero no debe interpretarse sin revisar la lógica del workflow y el reporte generado.

### 6.6 Bandit

En los archivos revisados no se encontró un job o configuración de Bandit. Bandit es una herramienta orientada a código Python; dado que el backend y frontend de VulnTrack están desarrollados en Node.js y React, el SAST se cubre con **Semgrep** y **ESLint con `eslint-plugin-security`**. No debe registrarse Bandit como ejecutada sin evidencia.

---

## 7. Cómo interpretar los reportes

| Campo | Interpretación | Acción |
| --- | --- | --- |
| **Severidad** | Nivel de riesgo asignado por herramienta | Priorizar críticas/altas y exposición pública; no basarse solo en el color. |
| **CVE / CWE / regla** | Identificador de vulnerabilidad o categoría de fallo | Comprender causa y aplicabilidad al código/imagen analizados. |
| **Componente y versión** | Paquete, imagen, archivo, endpoint o configuración afectada | Verificar que la versión desplegada corresponde al hallazgo. |
| **Evidencia** | Fragmento, endpoint, parámetro o cadena detectada | Reproducir en entorno controlado sin exponer datos sensibles. |
| **Remediación sugerida** | Actualización, cambio de código o configuración | Validar compatibilidad y probar la corrección. |
| **Estado** | Abierto, en análisis, mitigado, corregido, aceptado o falso positivo | Registrar responsable, fecha, justificación y evidencia de reanálisis. |

---

## 8. Proceso de gestión de vulnerabilidades

1. Registrar cada hallazgo con herramienta, fecha, versión/commit, componente, identificador, severidad y evidencia.
2. Validar si es reproducible y aplicable; documentar los falsos positivos con una justificación verificable.
3. Priorizar según severidad, exposición, criticidad del activo, impacto sobre datos multiempresa y disponibilidad de mitigación.
4. Asignar responsable y fecha objetivo según los SLA aprobados por el equipo. Los tiempos concretos deben ser definidos por el proyecto; no se inventan aquí.
5. Corregir mediante una rama y Pull Request; agregar o actualizar pruebas cuando corresponda.
6. Repetir el análisis que detectó el hallazgo y pruebas de regresión.
7. Cerrar solo con evidencia de corrección o registrar aceptación de riesgo aprobada, con propietario, vencimiento y controles compensatorios.
8. Conservar reporte original, reporte posterior, commit, decisión y fecha en un repositorio de evidencias con acceso controlado.

---

## 9. Gestión de incidentes por secretos

1. Revocar o rotar de inmediato el secreto afectado.
2. Determinar alcance, servicios y periodo de exposición.
3. Retirar el secreto del código y del historial cuando sea necesario; la eliminación del archivo no invalida una credencial comprometida.
4. Ejecutar Gitleaks de nuevo y documentar el resultado.
5. Registrar el incidente y medidas preventivas sin copiar el secreto en tickets o reportes.

---
[📄 Ver manual en PDF](Manual_4.5_Seguridad_SecureHub_CON_MONITOREO%20(1)%20(1).pdf)

