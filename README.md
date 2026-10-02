# VulnTrack — Plataforma DevSecOps de Gestión Integral de Vulnerabilidades (VAM)

![VulnTrack Banner](./frontend/public/vite.svg)

> Desarrollado por el equipo de Seguridad y DevSecOps.

**VulnTrack** es una plataforma para el seguimiento y remediación de vulnerabilidades informáticas, orientada a entornos corporativos **multi-tenant**. No es un antivirus ni un escáner estático: es el panel centralizado que unifica el inventario de activos, los hallazgos de seguridad (enriquecidos automáticamente desde la base nacional de vulnerabilidades del NIST/NVD), el análisis de riesgo y los planes de remediación con SLAs monitoreados de forma automatizada.

El flujo operativo sigue una secuencia estricta:

**[Inventario y Detección] → [Cálculo de Riesgo / Inteligencia] → [Remediación y Cierre]**

> **Nota del mantenedor**: El logo superior es el placeholder por defecto de Vite. Reemplázalo por un banner propio antes de publicar el repositorio en producción.

---

## Tabla de contenidos

1. [Stack Tecnológico](#stack-tecnológico)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Flujo Operativo y de Negocio](#flujo-operativo-y-de-negocio)
4. [Modelo Relacional de Datos (ERD)](#modelo-relacional-de-datos-erd)
5. [Control de Acceso Basado en Permisos (RBAC Dinámico)](#control-de-acceso-basado-en-permisos-rbac-dinámico)
6. [Prerrequisitos](#prerrequisitos)
7. [Variables de Entorno](#variables-de-entorno)
8. [Instrucciones de Despliegue Local](#instrucciones-de-despliegue-local)
9. [Solución de Problemas Comunes](#solución-de-problemas-comunes)
10. [Cuentas de Prueba](#cuentas-de-prueba)
11. [Postura de Seguridad y Checklist OWASP](#postura-de-seguridad-y-checklist-owasp)

---

## Stack Tecnológico

| Capa | Tecnología | Rol en el proyecto |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS, Lucide React | SPA con hot-reload en desarrollo, build optimizado en producción. |
| Backend | Node.js + Express | API REST, lógica de negocio y enrutamiento. |
| Base de datos | PostgreSQL 16 | Datos relacionales y **Row-Level Security (RLS)** para aislamiento estricto multi-tenant. |
| Caché / Mensajería | Redis 7 | Almacenamiento rápido de sesiones. *(Nota: Preparado para escalarse con middlewares de rate-limiting)*. |
| Automatización | `node-cron` | Hilo asíncrono integrado (`slaWorker.js`) para el monitoreo automatizado de vencimientos de SLA. |
| Autenticación | `jsonwebtoken`, `bcryptjs`, `speakeasy` + `qrcode` | JWT stateless, hashing robusto de contraseñas con salt automático, MFA/TOTP compatible con Google Authenticator. |
| Contenerización | Docker + Docker Compose | Orquestación local de base de datos, caché y API. |
| Proxy inverso | Nginx | Termina TLS, sirve estáticos y enruta a la API en entornos productivos. |

---

## Arquitectura del Sistema

La arquitectura aísla completamente a las empresas a nivel de base de datos mediante RLS (Row Level Security). Las tareas asíncronas se gestionan mediante un worker interno. En producción, la API y las bases de datos permanecen en la red interna de Docker, exponiendo únicamente Nginx.

```mermaid
graph TD
    subgraph "Zona pública / Internet"
        Client(["Usuario / Navegador"])
    end

    subgraph "Entorno de desarrollo"
        Vite["Vite Dev Server<br/>:5173"]
    end

    subgraph "Docker Compose - Red interna"
        Nginx["Nginx Reverse Proxy<br/>:80 / :443"]
        API["Node.js API Core<br/>:3000"]
        Worker["Worker (node-cron)<br/>Integrado en API"]
        DB[("PostgreSQL + RLS<br/>:5432")]
        Redis[("Redis<br/>:6379")]
    end

    NVD["API NVD / NIST<br/>(Fuente externa de CVEs)"]

    Client -->|"Peticiones"| Nginx
    Client -.->|"HTTP local"| Vite
    Nginx -->|"proxy_pass"| API
    Vite -->|"fetch /api"| API
    API <-->|"Queries parametrizadas"| DB
    API <-->|"Almacena sesiones"| Redis
    API -->|"Consulta HTTP"| NVD
    Worker -->|"Evalúa SLAs (Bypass RLS)"| DB

    classDef external fill:#444,stroke:#f66,color:#fff
    classDef worker fill:#1e3a5f,stroke:#4da3ff,color:#fff
    class NVD external
    class Worker worker
```

---

## Flujo Operativo y de Negocio

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Inventario

    state "Inventario y Activos" as Inventario {
        [*] --> RegistroActivos
        RegistroActivos: Alta de servidores, BDs, APIs
    }

    Inventario --> Deteccion

    state "Detección" as Deteccion {
        [*] --> CreacionHallazgo
        CreacionHallazgo --> ConsultaNVD
        CreacionHallazgo: Obligatorio ingresar ID
        ConsultaNVD: Auto-completado vía API NVD/NIST
    }

    Deteccion --> Inteligencia

    state "Inteligencia de Riesgo" as Inteligencia {
        [*] --> EvaluacionMatriz
        EvaluacionMatriz: Probabilidad x Impacto -> Score de Riesgo
    }

    Inteligencia --> Remediacion

    state "Remediación" as Remediacion {
        [*] --> AsignacionPlan
        AsignacionPlan --> ControlSLA
        AsignacionPlan: Asignación de fecha límite
        ControlSLA: Monitoreado por slaWorker.js
    }

    Remediacion --> Trazabilidad

    state "Trazabilidad" as Trazabilidad {
        [*] --> AuditoriaInmutable
        AuditoriaInmutable: Log append-only en EVENTOS_AUDITORIA
    }

    Trazabilidad --> [*]
```

---

## Modelo Relacional de Datos (ERD)

VulnTrack aísla de forma matemática a las empresas utilizando **Políticas RLS en PostgreSQL**. Además, cuenta con una tabla de roles dinámica por inquilino.

```mermaid
erDiagram
    EMPRESAS ||--o{ ROLES_EMPRESA : tiene
    EMPRESAS ||--o{ USUARIOS : contrata
    EMPRESAS ||--o{ ACTIVOS : posee
    EMPRESAS ||--o{ HALLAZGOS_VULN : reporta
    
    ROLES_EMPRESA {
        uuid id_rol PK
        uuid id_empresa FK
        string nombre
        jsonb permisos
        boolean estado
    }
    
    USUARIOS {
        uuid id_usuario PK
        uuid id_empresa FK
        string correo UK
        string password_hash
        string rol "Solo lectura/Referencia"
        boolean mfa_enabled
        string mfa_secret
        boolean estado
    }

    HALLAZGOS_VULN {
        uuid id_hallazgo PK
        string cve_id "Obligatorio"
        string severidad
        float cvss
        string estado_hallazgo
    }

    PLANES_REMEDIACION {
        uuid id PK
        uuid hallazgo_id FK
        uuid asignado_a FK
        date fecha_limite
        string estado "PENDIENTE|EN_CURSO|COMPLETADO|VENCIDO"
    }

    EVENTOS_AUDITORIA {
        uuid id_evento PK
        uuid id_usuario FK
        string accion
        jsonb detalles
        timestamp fecha_evento
    }
```

---

## Control de Acceso Basado en Permisos (RBAC Dinámico)

A diferencia de los sistemas tradicionales, VulnTrack no utiliza roles "quemados" (hardcoded). Implementa un motor dinámico:
1. El Administrador crea roles personalizados y les asigna permisos granulares (JSONB) en la tabla `roles_empresa`.
2. Al iniciar sesión, la matriz de permisos se empaqueta criptográficamente en el JWT.
3. El middleware en Node.js valida la existencia del permiso exacto antes de permitir la ejecución.

```mermaid
graph LR
    Req(["Petición HTTP"]) --> A["Middleware: verificarToken<br/>(Valida firma y expiración)"]
    A -->|"Token inválido"| F1(("401 Unauthorized"))
    A -->|"Token válido"| B{"Middleware autorizarRoles<br/>¿Contiene el permiso requerido?"}

    B -->|"{permisos: ['CREAR_USUARIOS']}"| C["Ejecución Permitida"]
    B -->|"Permiso faltante"| F2(("403 Forbidden"))

    F2 -.->|"Registra intento fallido"| Audit[("EVENTOS_AUDITORIA")]
    C -.->|"Registra acción de negocio"| Audit
```

---

## Prerrequisitos

Antes de clonar, verifica tener instaladas las siguientes herramientas:

| Herramienta | Comando de verificación | Notas |
|---|---|---|
| Docker | `docker --version` | Necesario para levantar DB, Redis y API localmente. |
| Docker Compose | `docker-compose version` | Verifica tu versión (standalone o plugin). |
| Node.js | `node -v` | (v18+) Necesario para correr el frontend (`npm run dev`). |
| Puertos | Verificar `3000`, `5432`, `5173` libres | Libera los puertos locales si tienes otros proyectos activos. |

---

## Variables de Entorno

Debes crear un archivo `.env` en la raíz del backend.

| Variable | Propósito | Notas de seguridad |
|---|---|---|
| `DB_HOST`, `DB_USER` | Credenciales de DB | Usar cuenta de bajo privilegio (`app_user`). |
| `JWT_SECRET` | Firma criptográfica JWT | Nunca hardcodear en código fuente. Usar una cadena compleja. |
| `NVD_API_KEY` | API Key de NIST (Opcional) | Evita bloqueos por Rate-Limit en la ingesta de CVEs. |

---

## Instrucciones de Despliegue Local
 
1. **Clonar el repositorio:**
```bash
   git clone <repo-url> VulnTrack
   cd VulnTrack
```
 
2. **Configurar variables de entorno:**
```bash
   cp .env.example .env
   # Edita .env con tus valores locales antes de continuar
```
 
3. **Levantar la infraestructura base (Docker):**
```bash
   docker compose up -d --build
```
   Esto aprovisiona PostgreSQL, Redis, la API y el Worker de `node-cron`. Verifica que el servicio `api` tenga `depends_on` con `condition: service_healthy` sobre `db` en tu `docker-compose.yml` — si la API arranca antes de que Postgres esté listo para aceptar conexiones, fallará en el primer intento de conexión y no todos los orquestadores la reinician automáticamente.
 
4. **Confirmar que todos los contenedores están arriba:**
```bash
   docker compose ps
```
   Todos los servicios deben mostrar estado `running` (o `healthy` si definiste healthchecks).
 
5. **Iniciar el entorno de desarrollo frontend (Hot-Reload):**
```bash
   cd frontend
   npm install
   npm run dev
```
   Abre el panel en: `http://localhost:5173`
 
6. **(Opcional) Ver logs en vivo de un servicio específico**, por ejemplo el worker, para confirmar que el cron job corre:
```bash
   docker compose logs -f worker
```
*Abre el panel en: `http://localhost:5173`*

---

## Solución de Problemas Comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Crash `pool.connect is not a function` en logs del API | La destructuración del archivo `db.js` falló en el SLA worker. | (Ya resuelto en v1.1). Verificar que se importa usando `const { pool } = require(...)`. |
| Menú de "Rol Inicial" aparece vacío | Faltan permisos de base de datos para la tabla `roles_empresa`. | Ejecutar `GRANT ALL PRIVILEGES ON TABLE roles_empresa TO app_user;` en PostgreSQL. |
| "Objects are not valid as a React child" en el Dashboard | Se intentó renderizar un JSON puro (la columna `detalles`) en React. | (Ya resuelto). Se debe mapear `notif.accion` en la interfaz. |
| Cierre de sesión (Logout) bloqueado | Política de MFA forzado. | Se debe escanear el QR e ingresar el PIN al menos una vez para habilitar la salida. |

---

## Cuentas de Prueba

Las bases de datos incluyen un seed inicial con la empresa ACME Corp y tres usuarios de prueba. Los roles son totalmente editables desde el panel:

| Correo | Rol Asignado |
|---|---|
| `admin@acme.com` | **ADMINISTRADOR** (Permiso "ALL") |
| `auditor@acme.com` | **AUDITOR** (Ver activos, Ver/Crear Vulnerabilidades) |
| `dev@acme.com` | **REMEDIADOR** (Acceso a planes de acción) |

**Nota de Seguridad (MFA):** Durante el primer inicio de sesión, el doble factor estará inactivo. El sistema forzará de manera estricta la configuración del MFA en cuanto el usuario intente desloguearse (Cerrar Sesión).

---

## Postura de Seguridad y Checklist OWASP

Este proyecto nace bajo un enfoque *Security-by-Design*:

| Categoría OWASP Top 10 (2021) | Contramedida Implementada y Verificada |
|---|---|
| **A01 – Broken Access Control** | RLS activo en Postgres; Middleware de permisos dinámicos en Node; Soft-Deletes. |
| **A02 – Cryptographic Failures** | `bcryptjs` con generador de sal automático para credenciales. JWT firmado correctamente. |
| **A03 – Injection** | Consultas estrictamente parametrizadas con `pg`. Prevención absoluta de SQLi. |
| **A04 – Insecure Design** | El `app_user` no tiene permisos para crear/eliminar tablas. Modelo Multi-tenant rígido. |
| **A07 – Auth Failures** | Expiración de JWT. Imposición mandatoria de MFA (TOTP) al salir. |
| **A09 – Security Logging** | Tabla inmutable `EVENTOS_AUDITORIA` que registra intentos exitosos, creaciones, 401 y 403. |
