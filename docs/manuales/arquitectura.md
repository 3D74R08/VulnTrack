# 4.2 Manual de Arquitectura — SecureHub / VulnTrack

| Campo | Valor |
| --- | --- |
| **Proyecto** | SecureHub / VulnTrack |
| **Subtítulo** | Plataforma de Gestión de Vulnerabilidades y Riesgos |
| **Licencia seleccionada** | MIT (`LICENSE`) |
| **Versión documental** | 1.0 — Octubre de 2026 |

---

## 1. Propósito y alcance

SecureHub / VulnTrack es una plataforma web multi-inquilino (multi-tenant) contenerizada para registrar activos tecnológicos, gestionar hallazgos de vulnerabilidad enriquecidos con CVE/NVD, evaluar el riesgo asociado y hacer seguimiento automatizado a los planes de remediación y sus SLAs.

La arquitectura separa la interfaz de usuario, la API REST, el worker asíncrono, el escáner, el servidor estático de evidencias y la observabilidad en contenedores independientes orquestados con Docker Compose (`docker-compose.yml`), mientras que PostgreSQL aplica aislamiento estricto por empresa mediante Row-Level Security (RLS) a nivel de motor.

---

## 2. Visión general de la arquitectura y componentes

| Componente | Tecnología | Servicio Compose | Responsabilidad |
| --- | --- | --- | --- |
| **Frontend** | React 19 + Vite, Tailwind CSS v4, Lucide React, Recharts, Nginx | `securehub-frontend` (`:80 -> :8080`) | SPA publicada en el puerto 80; consume la API REST con autenticación JWT Bearer. |
| **Backend / API** | Node.js + Express 4, `helmet`, `cors`, `pg`, `jsonwebtoken`, `bcryptjs`, `speakeasy` | `securehub-api` (`127.0.0.1:3000 -> :3000`) | Autenticación JWT + MFA TOTP, RBAC dinámico, lógica de negocio, proxy controlado a NVD y endpoints REST documentados con OpenAPI/Swagger. |
| **Worker asíncrono** | Node.js + `node-cron` (`src/workers/worker.js`) | `securehub-worker` | Proceso independiente para monitoreo automático de vencimiento de SLAs, reintentos de enriquecimiento NVD y notificaciones. |
| **Base de datos** | PostgreSQL 18 (`postgres:18.6-alpine`) + `pgcrypto` | `securehub-db` (`:5432` interno) | Persistencia relacional, integridad referencial, UUIDs criptográficos y aislamiento multi-tenant mediante políticas RLS sobre el usuario restringido `app_user`. |
| **Caché / Rate-limit** | Redis 7 (`redis:7-alpine`) | `securehub-redis` (`:6379` interno) | Almacenamiento de contadores de limitación de intentos de inicio de sesión anti fuerza bruta. |
| **Servidor estático** | Nginx (`nginx:alpine`) | `securehub-files` | Sirve archivos desde `files-data` con configuración endurecida. Este volumen es independiente de `uploads-data`, donde la API guarda evidencias y firmas. |
| **Escáner** | Node.js + Trivy (`./scanner`) | `securehub-scanner` | Escaneo programado de componentes del repositorio y envío de hallazgos a la API. |
| **Observabilidad** | Prometheus, Alertmanager, Grafana, Loki y Alloy | `prometheus`, `alertmanager`, `grafana`, `loki`, `alloy` | Recolección de métricas (`:9090`), gestión de alertas (`:9093`), dashboards (`:3001`) y centralización de logs de contenedores. |

---

## 3. Diagramas UML y DFD requeridos

### 3.1 Diagrama de Componentes de la Aplicación

El diagrama separa la interfaz, la API, los procesos asíncronos y los servicios de datos. Las flechas indican llamadas o dependencias reales del sistema.

```mermaid
---
config:
  layout: elk
  elk:
    nodePlacementStrategy: LINEAR_SEGMENTS
  flowchart:
    curve: linear
    nodeSpacing: 42
    rankSpacing: 72
---
flowchart LR
    U[Usuario] --> FE["securehub-frontend<br/>React · Vite · Nginx"]
    FE -->|"HTTP · JSON · JWT"| API["securehub-api<br/>Node.js · Express · REST"]

    subgraph Procesos["Procesos auxiliares"]
        direction TB
        SC["securehub-scanner<br/>Trivy"]
        WK["securehub-worker<br/>SLA · reintentos NVD"]
    end
    SC -->|"HTTP :3000"| API

    subgraph Datos["Persistencia y servicios"]
        direction TB
        DB[("PostgreSQL 18<br/>RLS · datos del tenant")]
        RD[("Redis 7<br/>límite de intentos")]
        UP[("uploads-data<br/>evidencias · firmas")]
        FILES[("files-data<br/>archivos estáticos")]
        FILE["securehub-files<br/>Nginx estático"]
    end
    API -->|"SQL · contexto tenant"| DB
    WK -->|"SQL · SLA"| DB
    API <-->|"rate-limit"| RD
    API -->|"lectura / escritura"| UP
    FILE --> FILES

    NVD["NIST · NVD<br/>API de CVE"]
    API -->|"consulta CVE"| NVD
    WK -->|"enriquecimiento CVE"| NVD

    classDef actor fill:#172554,stroke:#60a5fa,color:#eff6ff,stroke-width:1.5px
    classDef app fill:#172033,stroke:#5b9cff,color:#e5edf9,stroke-width:1.5px
    classDef service fill:#202a3a,stroke:#8293aa,color:#e5edf9
    classDef store fill:#122a2a,stroke:#4db6ac,color:#e5edf9
    classDef external fill:#30251a,stroke:#e0a458,color:#fff4df
    class U actor
    class FE,API app
    class SC,WK,FILE service
    class DB,RD,UP store
    class NVD external
```

### 3.2 Diagrama de Observabilidad

Métricas y registros siguen recorridos independientes: Prometheus consulta la API, mientras Alloy recoge los logs de Docker y los envía a Loki. Grafana consulta ambas fuentes.

```mermaid
---
config:
  layout: elk
  elk:
    nodePlacementStrategy: LINEAR_SEGMENTS
  flowchart:
    curve: linear
    nodeSpacing: 48
    rankSpacing: 76
---
flowchart LR
    subgraph Fuentes["Fuentes"]
        direction TB
        API["securehub-api<br/>/metrics"]
        DOCKER["Contenedores Docker<br/>logs"]
    end
    subgraph Recoleccion["Recolección"]
        direction TB
        PROM[Prometheus]
        ALLOY[Alloy]
    end
    subgraph Gestion["Alertas y almacenamiento"]
        direction TB
        ALERT[Alertmanager]
        LOKI[Loki]
    end
    GRAF[Grafana]

    PROM -->|"scrape · /metrics"| API
    PROM -->|"reglas de alerta"| ALERT
    DOCKER -->|"Docker socket · lectura"| ALLOY
    ALLOY -->|"push de logs"| LOKI
    GRAF -->|"PromQL"| PROM
    GRAF -->|"LogQL"| LOKI
```

### 3.3 Diagrama de Despliegue

El límite agrupa los contenedores de la red Docker. Las conexiones del navegador muestran los puertos publicados; las demás flechas son tráfico interno entre servicios.

```mermaid
---
config:
  layout: elk
  elk:
    nodePlacementStrategy: LINEAR_SEGMENTS
  flowchart:
    curve: linear
    nodeSpacing: 38
    rankSpacing: 64
---
flowchart TB
    BROWSER["Navegador del usuario"]
    NVD["NIST · NVD"]

    subgraph HOST["Host Docker · red securehub_lan"]
        direction TB
        subgraph APP["Aplicación"]
            direction LR
            FE["securehub-frontend<br/>Nginx · host :80 → :8080"]
            API["securehub-api<br/>Express · host 127.0.0.1:3000"]
            WK["securehub-worker<br/>SLA · NVD"]
            SC["securehub-scanner<br/>Trivy"]
        end
        subgraph STORAGE["Persistencia"]
            direction LR
            DB[("securehub-db<br/>PostgreSQL · :5432 interno")]
            REDIS[("securehub-redis<br/>:6379 interno")]
            UP[("uploads-data<br/>evidencias · firmas")]
            FILE["securehub-files<br/>Nginx estático"]
            FILES[("files-data")]
        end
        subgraph OBS["Observabilidad"]
            direction LR
            PROM["Prometheus · :9090"]
            ALERT["Alertmanager · :9093"]
            GRAF["Grafana · host :3001 → :3000"]
            ALLOY[Alloy]
            LOKI["Loki · :3100 interno"]
        end
    end

    BROWSER -->|"HTTP :80"| FE
    BROWSER -.->|"API local :3000"| API
    BROWSER -->|"Dashboard :3001"| GRAF
    FE -->|"REST API :3000"| API
    SC -->|"HTTP interno :3000"| API
    API -->|"TCP :5432 · app_user / RLS"| DB
    API -->|"TCP :6379"| REDIS
    WK -->|"SQL · SLA"| DB
    API --> UP
    FILE --> FILES
    API -->|"consulta CVE"| NVD
    WK -->|"enriquecimiento CVE"| NVD
    PROM -->|"scrape /metrics"| API
    PROM -->|"alertas"| ALERT
    ALLOY -->|"push de logs"| LOKI
    GRAF -->|"PromQL"| PROM
    GRAF -->|"LogQL"| LOKI
```

| Servicio | Volúmenes persistentes |
|---|---|
| `securehub-db` | `postgres-data`, `backups-data` |
| `securehub-redis` | `redis-data` |
| `securehub-files` | `files-data` |
| `securehub-api` | `uploads-data`, `logs-data` |
| `securehub-scanner` | `logs-data` |
| Prometheus, Alertmanager, Grafana, Loki y Alloy | `prometheus-data`, `alertmanager-data`, `grafana-data`, `loki-data`, `alloy-data` |

### 3.4 Diagrama de Secuencia (Autenticación con MFA TOTP condicional)

Describe el inicio de sesión con validación de contraseña mediante `bcryptjs`; el segundo factor TOTP (`speakeasy`) se solicita solo si está habilitado en la cuenta. Al final se emite el token JWT con permisos RBAC:

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Interfaz React
    participant API as API Express (AuthController)
    participant RD as Redis (rate-limit)
    participant DB as PostgreSQL
    participant MFA as Verificación TOTP (speakeasy)

    U->>FE: 1. Introducir correo y contraseña
    FE->>API: 2. POST /api/auth/login
    API->>RD: 3. Comprobar límite de intentos
    RD-->>API: 4. Solicitud permitida
    API->>DB: 5. Buscar usuario activo y datos MFA
    DB-->>API: 6. Hash bcrypt, rol, secreto y estado MFA
    API->>API: 7. Validar contraseña con bcrypt.compare()

    opt MFA habilitado en la cuenta
        API-->>FE: 8. Solicitar segundo factor (mfa_requerido: true)
        FE-->>U: 9. Mostrar campo de código TOTP
        U->>FE: 10. Introducir código MFA
        FE->>API: 11. Reenviar credenciales y mfa_token
        API->>RD: 12. Comprobar límite de intentos
        RD-->>API: 13. Solicitud permitida
        API->>MFA: 14. Verificar código con el secreto consultado
        MFA-->>API: 15. Resultado de validación TOTP
    end

    API->>DB: 16. Consultar permisos del rol en roles_empresa
    DB-->>API: 17. Permisos JSONB
    API->>API: 18. Firmar JWT con expiración de 8 horas
    API-->>FE: 19. HTTP 200 { token }
    FE-->>U: 20. Acceso autorizado al Dashboard
```

---

### 3.5 Diagrama de Casos de Uso

El diagrama usa la notación UML: actores fuera del límite de SecureHub, casos de uso en óvalos y asociaciones sin flechas. Se divide por perfil para que las relaciones sean legibles. Los permisos reflejan los roles definidos por la aplicación.

![Diagrama UML de casos de uso de SecureHub, separado por perfiles de administrador, auditor y remediador](diagramas/casos-uso.svg)

### 3.6 Diagramas de Flujo de Datos (DFD Nivel 0 y Nivel 1 — OWASP Threat Dragon)

Se incluyen los dos niveles del modelo formal `security/threat-model.json`, validado en **OWASP Threat Dragon 2.6.2** y comprobado en CI. Los rectángulos representan entidades externas, los procesos tienen bordes redondeados y los cilindros representan almacenes de datos. Las flechas muestran el sentido del flujo; los límites agrupan los elementos dentro del alcance de SecureHub.

#### DFD Nivel 0 — Contexto

```mermaid
---
config:
  layout: elk
  elk:
    nodePlacementStrategy: LINEAR_SEGMENTS
  flowchart:
    curve: linear
    nodeSpacing: 60
    rankSpacing: 100
---
flowchart LR
    USER["Usuario / Administrador"]
    subgraph APP["SecureHub · Frontend + API + Worker"]
        direction TB
        SYSTEM([Sistema de gestión de vulnerabilidades])
    end
    DB[("PostgreSQL · datos de negocio")]
    NVD["NIST NVD API · servicio externo"]

    USER -->|"HTTPS · JWT"| SYSTEM
    SYSTEM -->|"SQL · RLS"| DB
    SYSTEM -->|"HTTPS · consulta CVE"| NVD
```

El nivel 0 contiene 7 celdas: el actor, la aplicación, PostgreSQL, NIST NVD y los tres flujos. Registra 3 amenazas STRIDE mitigadas: suplantación de cuenta, acceso entre empresas y alteración o lectura indebida de datos.

#### DFD Nivel 1 — Servicios y límites de confianza

```mermaid
---
config:
  layout: elk
  elk:
    nodePlacementStrategy: LINEAR_SEGMENTS
  flowchart:
    curve: linear
    nodeSpacing: 48
    rankSpacing: 78
---
flowchart LR
    USER[Usuario]
    OPERATOR["Operador Docker"]

    subgraph HOST["Entorno Docker · securehub_lan"]
        direction LR
        subgraph APP["Servicios de aplicación"]
            direction TB
            FE(["Frontend · React / Nginx"])
            API(["API Express · JWT / RBAC / RLS"])
            SCAN(["Scanner · Trivy"])
            WORKER(["Worker · SLA / NVD / correo"])
            COMPOSE(["Docker Compose · configuración"])
        end
        subgraph DATA["Almacenes de datos"]
            direction TB
            DB[("PostgreSQL · RLS")]
            REDIS[("Redis · rate limit")]
            UPLOADS[("uploads-data · evidencias")]
        end
    end

    NVD["NIST NVD API · externa"]
    SMTP["Servidor SMTP · externo"]

    USER -->|HTTPS| FE
    FE -->|"HTTP interno · API_URL"| API
    SCAN -->|"HTTP · API_URL"| API
    API -->|"SQL · contexto tenant"| DB
    API -->|"Rate limit"| REDIS
    API -->|"Archivos · evidencias"| UPLOADS
    WORKER -->|"SQL · consultas SLA / NVD"| DB
    API -->|"HTTPS · consulta CVE"| NVD
    WORKER -->|"HTTPS · enriquecimiento CVE"| NVD
    WORKER -->|"SMTP · avisos SLA"| SMTP
    OPERATOR -->|"Configuración y secretos locales"| COMPOSE
```

El nivel 1 contiene 23 celdas: 12 elementos y 11 flujos. Registra 5 amenazas STRIDE mitigadas relacionadas con autenticación, denegación de servicio, auditoría, aislamiento multiempresa y modificación de datos. `security/threat-model.json` conserva el modelo editable y sus detalles de mitigación.

## 4. Modelo relacional de datos (ERD) y decisiones de diseño

El esquema relacional definido en `base_datos/init.sql` y sus migraciones (`02-migration-v2.sql` a `05-migration-v5.sql`) se estructura en torno al aislamiento multi-tenant por `id_empresa`:

```mermaid
---
config:
  layout: dagre
  er:
    layoutDirection: TB
    theme: default
    look: classic
  flowchart:
    curve: linear
---
erDiagram
    EMPRESAS {
        uuid id_empresa PK
        varchar nombre_empresa
        boolean estado
    }
    ROLES_EMPRESA {
        uuid id_rol PK
        uuid id_empresa FK
        varchar nombre
        jsonb permisos
        boolean estado
    }
    USUARIOS {
        uuid id_usuario PK
        uuid id_empresa FK
        varchar nombre_completo
        varchar correo
        varchar rol
        boolean estado
    }
    ACTIVOS {
        uuid id_activo PK
        uuid id_empresa FK
        varchar nombre
        varchar tipo
        varchar criticidad
        varchar estado_activo
    }
    HALLAZGOS_VULN {
        uuid id_hallazgo PK
        uuid id_empresa FK
        uuid id_activo FK
        uuid id_auditor FK
        varchar cve_id
        varchar severidad
        varchar estado_hallazgo
    }
    RIESGOS {
        uuid id_riesgo PK
        uuid id_empresa FK
        uuid id_hallazgo FK
        uuid evaluado_por FK
        int probabilidad
        int impacto
        int puntaje
        varchar clasificacion
    }
    PLANES_REMEDIACION {
        uuid id_plan PK
        uuid id_empresa FK
        uuid id_activo FK
        uuid id_remediador FK
        uuid creado_por FK
        varchar nombre
        varchar prioridad
        varchar estado_plan
    }
    PLAN_VULNERABILIDADES {
        uuid id_empresa FK
        uuid id_plan PK, FK
        uuid id_hallazgo PK, FK
        boolean estado
    }
    EVIDENCIAS {
        uuid id_evidencia PK
        uuid id_empresa FK
        uuid id_hallazgo FK
        uuid id_plan FK
        uuid subido_por FK
        varchar tipo
        varchar ruta_archivo
    }
    HISTORIAL_VULNERABILIDAD {
        uuid id_historial PK
        uuid id_empresa FK
        uuid id_hallazgo FK
        uuid id_usuario FK
        varchar estado_anterior
        varchar estado_nuevo
    }
    NOTIFICACIONES {
        uuid id_notificacion PK
        uuid id_empresa FK
        uuid id_usuario FK
        varchar tipo
        varchar titulo
        boolean leida
    }
    EVENTOS_AUDITORIA {
        uuid id_evento PK
        uuid id_empresa FK
        uuid id_usuario FK
        varchar accion
        varchar modulo
        timestamp fecha_evento
    }
    ACEPTACIONES_RIESGO {
        uuid id_aceptacion PK
        uuid id_empresa FK
        uuid id_hallazgo FK
        uuid aceptado_por FK
        date fecha_revision
        boolean estado
    }

    EMPRESAS ||--o{ ROLES_EMPRESA : define
    EMPRESAS ||--o{ USUARIOS : aloja
    EMPRESAS ||--o{ ACTIVOS : registra
    EMPRESAS ||--o{ HALLAZGOS_VULN : registra
    EMPRESAS ||--o{ RIESGOS : gestiona
    EMPRESAS ||--o{ PLANES_REMEDIACION : gestiona
    EMPRESAS ||--o{ PLAN_VULNERABILIDADES : gestiona
    EMPRESAS ||--o{ EVIDENCIAS : almacena
    EMPRESAS ||--o{ HISTORIAL_VULNERABILIDAD : registra
    EMPRESAS ||--o{ NOTIFICACIONES : genera
    EMPRESAS ||--o{ EVENTOS_AUDITORIA : audita
    EMPRESAS ||--o{ ACEPTACIONES_RIESGO : registra
    ACTIVOS ||--o{ HALLAZGOS_VULN : presenta
    ACTIVOS o|--o{ PLANES_REMEDIACION : asociado
    USUARIOS o|--o{ HALLAZGOS_VULN : audita
    USUARIOS o|--o{ RIESGOS : evalua
    USUARIOS o|--o{ PLANES_REMEDIACION : crea_o_remedia
    USUARIOS o|--o{ EVIDENCIAS : sube
    USUARIOS o|--o{ HISTORIAL_VULNERABILIDAD : registra
    USUARIOS o|--o{ NOTIFICACIONES : recibe
    USUARIOS o|--o{ EVENTOS_AUDITORIA : ejecuta
    USUARIOS o|--o{ ACEPTACIONES_RIESGO : acepta
    HALLAZGOS_VULN ||--o{ RIESGOS : evalua
    HALLAZGOS_VULN ||--o{ PLAN_VULNERABILIDADES : incluido_en
    PLANES_REMEDIACION ||--o{ PLAN_VULNERABILIDADES : agrupa
    HALLAZGOS_VULN o|--o{ EVIDENCIAS : documenta
    PLANES_REMEDIACION o|--o{ EVIDENCIAS : respalda
    HALLAZGOS_VULN ||--o{ HISTORIAL_VULNERABILIDAD : cambia
    HALLAZGOS_VULN ||--o{ ACEPTACIONES_RIESGO : puede_tener
```

### Decisiones clave de arquitectura de datos

* **Aislamiento nativo por Row-Level Security (RLS):** Las políticas de PostgreSQL comparan `id_empresa::text` contra la variable de sesión `app.current_tenant` establecida mediante `set_config('app.current_tenant', $1, true)`.
* **Principio de mínimo privilegio (`app_user`):** El contenedor `securehub-api` y `securehub-worker` operan con el rol `app_user` (creado en `00-create-app-user.sh`), nunca como superusuario `postgres`, garantizando que las políticas RLS sean aplicadas de forma obligatoria por el motor.
* **UUIDs criptográficos:** Uso de `gen_random_uuid()` (`pgcrypto`) para impedir ataques de enumeración secuencial (IDOR).
* **Borrado lógico (Soft Delete):** Preservación de integridad histórica y trazabilidad mediante columnas de estado en lugar de borrado físico.
* **Bitácora de auditoría (`eventos_auditoria`):** Registro de eventos de negocio y seguridad con detalles en formato `JSONB`, dirección IP de origen y marca de tiempo.
