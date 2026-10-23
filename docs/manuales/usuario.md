# 4.6 Manual de Usuario — SecureHub / VulnTrack

*Guía para acceder a la aplicación y utilizar sus principales funcionalidades*

| Campo | Valor |
| --- | --- |
| **Nombre** | Manual de Usuario de SecureHub / VulnTrack |
| **Código** | 4.6 |
| **Versión** | 1.2 — Octubre de 2026 |
| **Licencia** | MIT (`LICENSE`) |
| **Propósito** | Orientar al usuario final en el uso de las funcionalidades disponibles. |
| **Fuente funcional** | `Manual funcional.docx` compartido para el proyecto. |
| **Alcance visual** | Se conservan todas las descripciones y secuencias de pantallas del documento funcional original. |
| **Estado** | Documento consolidado; validar las pantallas contra la versión desplegada antes de la entrega final. |

---

## 1. Objetivo

Orientar al usuario, paso a paso, en el acceso a SecureHub y en el uso de sus módulos: administración de usuarios y roles, gestión de activos y vulnerabilidades, importación de información, consulta de riesgos, seguimiento de planes de remediación, carga de evidencias, generación de reportes y configuración de preferencias.

---

## 2. Alcance y público objetivo

Este manual está dirigido a los usuarios con perfiles **Administrador**, **Auditor** y **Remediador**. Las opciones disponibles y las acciones que cada usuario puede ejecutar dependen de los permisos asignados a su cuenta y de la configuración de la aplicación.

---

## 3. Requisitos previos

* Contar con una cuenta de usuario activa, habilitada por el administrador.
* Abrir un navegador web e ingresar a la dirección de SecureHub proporcionada por el responsable del despliegue.
* Disponer de una aplicación autenticadora compatible (ej. Google Authenticator) para configurar y generar los códigos de autenticación multifactor (MFA).
* Tener asignados los permisos requeridos para las operaciones que se van a realizar, como crear o modificar registros.
* Para pruebas o demostraciones, utilizar información de prueba y evitar adjuntar contraseñas, tokens u otros datos secretos.

---

## 4. Índice de funcionalidades y guía paso a paso

* **Inicio de sesión:** configuración inicial de MFA y validación mediante código en los accesos posteriores.
* **Pantalla principal:** navegación por los módulos y selección del modo claro u oscuro.
* **Usuarios:** creación de cuentas y asignación del rol inicial.
* **Roles y permisos:** consulta de los roles predeterminados —Administrador, Auditor y Remediador— y asignación de permisos.
* **Activos:** registro manual, diligenciamiento de campos obligatorios, consulta del listado y visualización del detalle.
* **Vulnerabilidades:** registro de hallazgos, consulta de información CVE, asociación con activos y revisión del detalle.
* **Importación:** descarga y diligenciamiento de la plantilla de Excel, carga de archivos, revisión de resultados y consulta del registro de errores.
* **Riesgos:** consulta del tablero por nivel de riesgo y revisión de las vulnerabilidades asociadas.
* **Remediación:** consulta y filtrado de planes, asignación de responsables, actualización de estados y seguimiento de los SLA.
* **Evidencias:** adjunto de soportes asociados a un plan, registro de comentarios e historial de cambios.
* **Reportes:** generación de informes ejecutivos y de cumplimiento de SLA en formato PDF.
* **Configuración:** administración de MFA, preferencias de visualización y consulta de notificaciones.

---

### 4.1 Inicio de sesión y configuración de MFA

1. **Ingreso de credenciales:** Para ingresar a SecureHub, escriba el nombre de usuario (o correo electrónico) y la contraseña asignados y seleccione la opción **«Iniciar sesión»**.
2. **Política de MFA obligatorio:** En el primer acceso, SecureHub solicita configurar la autenticación multifactor (MFA). Este paso es obligatorio para completar la configuración inicial de la cuenta antes de cerrar sesión.
3. **Vinculación mediante código QR:** La aplicación presenta un código QR en el modal **«Activar MFA»** que debe escanearse con una aplicación autenticadora compatible (Google Authenticator) para vincular la cuenta y generar los códigos MFA de 6 dígitos.
4. **Confirmación de activación:** Cuando la configuración finaliza correctamente tras ingresar el código de verificación, SecureHub muestra el mensaje `¡MFA Activado exitosamente!`.
5. **Accesos posteriores:** Una vez configurado el MFA, los siguientes inicios de sesión solicitan, además del usuario y la contraseña, el código temporal de 6 dígitos generado por la aplicación autenticadora en la pantalla **«Verificar Identidad»**.
6. **Pantalla principal (Dashboard):** Después de iniciar sesión, se muestra la pantalla principal con los módulos disponibles en el menú lateral: *Inicio*, *Usuarios*, *Roles y Permisos*, *Activos*, *Vulnerabilidades*, *Importación*, *Riesgos*, *Remediación*, *Evidencias*, *Reportes* y *Configuración*. También se puede cambiar entre el modo claro y el modo oscuro. En la parte superior derecha se identifica la cuenta y el rol con el que se inició sesión.

---

### 4.2 Menú Usuarios

1. El módulo **Usuarios** permite administrar las cuentas registradas en la empresa. Para agregar una nueva cuenta, seleccione el botón **«+ Crear Usuario»**.
2. Al seleccionar **«Crear Usuario»**, se abre el formulario modal **«Crear Nuevo Usuario»** donde deben ingresarse:
   * *Nombre Completo*
   * *Correo Electrónico*
   * *Contraseña*
   * *Rol Inicial*
3. El formulario incluye los roles disponibles de forma predeterminada (`ADMINISTRADOR`, `AUDITOR`, `REMEDIADOR`) o personalizados. Seleccione el rol que corresponda a las funciones que desempeñará la persona usuaria y pulse **«Crear Usuario»**.

---

### 4.3 Menú Roles y Permisos

1. El módulo **Roles y Permisos** (*Roles Dinámicos y Permisos*) permite consultar y gestionar los permisos asociados a los roles disponibles en la aplicación: **ADMINISTRADOR** (*Acceso total al sistema*), **AUDITOR** (*Consulta y registro de vulnerabilidades*) y **REMEDIADOR** (*Gestión de planes de remediación*).
2. Al pulsar **«+ Crear Nuevo Rol»**, el formulario permite indicar el *Nombre del Rol*, su *Descripción* y seleccionar los permisos granulares específicos que tendrá asignados:
   * *Ver Usuarios* / *Gestionar Usuarios (Crear/Editar)*
   * *Ver Activos* / *Gestionar Activos*
   * *Ver Vulnerabilidades* / *Gestionar Vulnerabilidades*
   * *Ver Riesgos* / *Gestionar Riesgos*
   * *Ver Planes de Acción* / *Gestionar Planes de Acción*
   * *Ver Registros de Auditoría* / *Administrar Roles y Permisos*
3. Mediante la opción **«Editar Rol»** se pueden revisar y ajustar los permisos asociados a cada rol (por ejemplo, `AUDITOR` o `REMEDIADOR`) y verificar que correspondan a las responsabilidades asignadas.

---

### 4.4 Menú Activos

1. El módulo **Activos** (*Gestión de Activos*) permite consultar los activos registrados filtrados por categoría (*Todos*, *Servidores*, *Equipos*, *Aplicaciones*, *Red*, *Base de datos*) y crear nuevos registros de forma manual mediante el botón **«+ Registrar activo»**.
2. Al seleccionar la opción para registrar un activo, se presenta el formulario **«Registrar Nuevo Activo (FRD V2)»** dividido en tres secciones:
   * **Información Principal:** *Código de Activo \** (ej. `SRV-001`), *Nombre \**, *Tipo de Activo \** (`Servidor`, `Equipo / Endpoint`, `Aplicación Web`, `API / Microservicio`, `Base de datos`, `Dispositivo de Red`), *Criticidad del Negocio \** (`Crítica (SLA Estricto)`, `Alta`, `Media`, `Baja`) y *Estado Operativo* (`Activo / Producción`, `Inactivo`, `Mantenimiento`, `Desarrollo / Testing`).
   * **Especificaciones Técnicas:** *Marca / Proveedor*, *Modelo*, *Número de Serie / Licencia*, *Hostname / FQDN*, *Dirección IP (Local/Pública)* y *Sistema Operativo*.
   * **Contexto Organizacional:** *Usuario Responsable*, *Área / Departamento*, *Ubicación / Sede* y *Descripción / Notas*.
3. Los campos obligatorios están identificados con un asterisco (`*`). Después de completar los campos requeridos y guardar el formulario con **«Guardar Activo»**, el activo aparece en el listado de registros.
4. Al seleccionar **«Ver Detalle»**, se abre un panel lateral con las especificaciones del activo, las vulnerabilidades abiertas registradas y los planes de remediación asociados.

---

### 4.5 Menú Vulnerabilidades

1. El módulo **Vulnerabilidades** (*Gestión de Vulnerabilidades*) permite consultar y filtrar hallazgos por severidad o estado, y registrar nuevos hallazgos mediante el botón **«+ Registrar Hallazgo»**.
2. Al seleccionar **«Registrar Hallazgo»**, se abre el formulario **«Registrar Vulnerabilidad»**. En el bloque **Búsqueda Inteligente NVD (Opcional)**, introduzca el identificador CVE (ej. `CVE-2021-44228`) y pulse **«Obtener Datos»** para consultar la información oficial disponible en la fuente NVD/NIST.
3. Si encuentra información, la aplicación autocompleta el *Título de la Vulnerabilidad*, la *Descripción*, la *Severidad* y el *CVSS Base Score*.
4. A continuación, seleccione en el desplegable **Activo Afectado (Relación 1:N) \*** el activo al que corresponde el hallazgo para establecer la relación entre ambos registros y pulse **«Guardar Hallazgo»**.
5. En el listado, pulse **«Ver Detalle»** sobre la vulnerabilidad registrada para consultar el puntaje CVSS, la descripción técnica, la **Evaluación de Riesgo Local** (Probabilidad × Impacto y botón *Aceptar riesgo*) y los **Planes de Remediación Asociados**.

---

### 4.6 Menú Importación

1. El módulo **Importación** (*Carga Masiva de Datos*) permite cargar de forma masiva información de activos y vulnerabilidades asociadas utilizando la plantilla oficial en formato Excel (`.xlsx`).
2. Seleccione **«1. Descargar Plantilla → Descargar Plantilla Excel»** para obtener el archivo `SecureHub_Carga_Masiva.xlsx`.
3. La plantilla contiene tres hojas:
   * **Activos:** `codigo_activo`, `nombre`, `tipo`, `marca`, `modelo`, `numero_serie`, `hostname`, `direccion_ip`, `endpoint`, `sistema_operativo`, `version_so`, `usuario_responsable`, etc.
   * **Vulnerabilidades:** `codigo_activo`, `cve`, `fecha_identificacion`, `fuente`, `estado`, `observaciones`.
   * **Instrucciones:** reglas de formato, tipos permitidos y comportamiento Upsert / enriquecimiento automático NVD en segundo plano.
4. Después de completar la plantilla y eliminar las filas de ejemplo, seleccione el archivo en **«2. Cargar Archivo»** y pulse **«Iniciar Importación»**.
5. Al finalizar la importación, la aplicación presenta el resumen con el conteo de *Activos Nuevos*, *Activos Actualizados*, *Vulns. Importadas* y *Enriqueciendo NVD*. Si la plantilla tiene campos obligatorios vacíos o errores de formato, se muestra el bloque **Advertencias durante la importación** detallando la hoja y fila que deben corregirse.

---

### 4.7 Menú de Riesgos

1. El módulo **Riesgos** (*Evaluación y Gestión de Riesgos*) presenta un tablero de consulta con:
   * **Matriz de Riesgos (Mapa de calor):** cruza *Impacto* (`MUY BAJO` a `CRITICO`) contra *Probabilidad* (`MUY BAJA` a `CRITICA`).
   * **Resumen Global:** muestra el riesgo global predominante y el conteo total desglosado en *Críticos*, *Altos*, *Medios* y *Bajos*, además del botón **«+ Auto-Evaluar Pendientes»**.
   * **Gráfico de Activos por Nivel de Riesgo** y tabla **Detalle de Vulnerabilidades y Activos** con la severidad CVSS, probabilidad, impacto y riesgo calculado.

---

### 4.8 Menú Remediación

1. El módulo **Remediación** (*Planes de Remediación*) muestra los planes registrados con su *Prioridad*, *Responsable*, *Estado* y *Progreso / SLA* (días restantes o vencidos).
2. Al expandir un plan en la lista, es posible actualizar el **Control de Estado** (`Pendiente`, `En Ejecución`, `Completado`, `Cancelado`) y **Asignar responsable** (remediador o administrador), además de consultar las *Vulnerabilidades a Mitigar*, los *Activos Afectados* y las tareas sugeridas del *Plan de acción*.
3. También se puede filtrar la lista por estado, búsqueda de texto o la casilla *Mis planes*.
4. Para crear un plan manualmente, seleccione **«+ Crear Plan de Acción»**. En el modal **«Diseñar Plan de Remediación»**, complete:
   * *Nombre del Plan \**
   * *Objetivo / Descripción*
   * *Plan de Acción / Tareas (Step-by-Step) \**
   * *Prioridad \** (`Baja`, `Media`, `Alta`, `Crítica`) y *Responsable \**
   * *Fecha de Inicio \** y *Fecha Límite (SLA) \**
   * *Alcance (Hallazgos) \**: seleccione una o varias vulnerabilidades que el plan mitigará simultáneamente y pulse **«Guardar Plan de Remediación»**.
5. Si la fecha límite configurada ya pasó, el sistema indica visualmente que el SLA se encuentra vencido (ej. `2d Vencido`).

---

### 4.9 Menú Evidencias

1. El módulo **Evidencias** (*Toda la trazabilidad, en un solo lugar*) permite adjuntar soportes documentales o capturas relacionados con un plan de remediación y consultar la bitácora de **Evidencias y Auditoría**.
2. En la sección **Subir Nueva Evidencia**:
   * Seleccione el **Plan de Remediación** correspondiente.
   * Seleccione el **Archivo de Evidencia**.
   * Escriba un **Comentario** que describa la acción correctiva o el soporte de cierre.
   * Pulse **«Subir Evidencia»**.
3. En la tabla inferior **Evidencias y Auditoría**, consulte el historial cronológico de acciones del sistema (*Fecha / Hora*, *Usuario*, *Acción* como `REMEDIATION_CREATED`, `PLAN_EXPIRED`, `VULNERABILITY_STATUS_CHANGED`, y *Módulo*).

---

### 4.10 Menú Reportes

1. El módulo **Reportes** permite generar y visualizar informes del estado de seguridad y cumplimiento en pestañas *Ejecutivos* y *Técnicos*:
   * **Reporte ejecutivo:** resumen de estado, total de activos, hallazgos por severidad, planes por estado y alertas recientes (disponible en **Descargar Markdown** y **Exportar a PDF**).
   * **Reporte de cumplimiento SLA:** tabla detallada de planes de remediación con prioridad, fecha límite, estado, responsable y estado del SLA (*A tiempo* / *Vencido*), exportable a Markdown y PDF.

---

### 4.11 Menú Configuración, Tema Visual, Notificaciones y Control de Acceso por Rol

1. **Configuración:** Desde el módulo **Configuración** se puede gestionar la opción **«Configurar MFA»** para la cuenta actual.
2. **Modo Claro / Modo Oscuro:** En la esquina inferior izquierda de la barra lateral, el usuario puede alternar en cualquier momento entre **Modo Claro** y **Modo Oscuro**.
3. **Notificaciones:** El icono de campana en la barra superior despliega las alertas recientes del sistema (por ejemplo, `PLAN_VENCIDO`, `PLAN_ASIGNADO`, `VULN_CRITICA`).
4. **Restricción por perfil (RBAC):** Cuando se inicia sesión con un perfil distinto al de Administrador (por ejemplo, `REMEDIADOR`), la aplicación oculta o deshabilita las acciones no autorizadas (mostrando `Sin permisos` en la columna de acciones o el aviso `No tienes permisos para acceder a este módulo.`).

---

## 5. Historia de usuario para la sustentación

> **Historia de usuario:** Como **auditor de seguridad**, quiero registrar una vulnerabilidad asociada a un activo, consultar su riesgo y crear un plan de remediación con responsable y fecha límite, para hacer seguimiento hasta contar con evidencia de la acción correctiva.

### Criterios de aceptación

* Dado un activo existente, el auditor puede registrar un hallazgo y relacionarlo con ese activo.
* El detalle del hallazgo permite consultar la información disponible de la vulnerabilidad y el riesgo asociado.
* Un usuario autorizado puede crear un plan de acción con responsable, prioridad y fechas.
* El usuario puede adjuntar una evidencia y un comentario al plan.
* El usuario puede consultar el estado del plan y verificar el SLA cuando corresponda.

### Guion de demostración

1. Iniciar sesión con una cuenta de prueba autorizada.
2. Seleccionar un activo existente o crear uno de prueba.
3. Registrar un hallazgo CVE y asociarlo con el activo.
4. Consultar el detalle del hallazgo y su riesgo.
5. Crear un plan de remediación con responsable y fecha límite.
6. Adjuntar evidencia de prueba y comentario.
7. Mostrar el estado del plan y el historial o reporte disponible.

---

## 6. Recomendaciones de uso seguro

* No compartir credenciales ni códigos MFA.
* Asignar roles siguiendo el principio de mínimo privilegio.
* Validar los datos antes de guardarlos o importarlos.
* No adjuntar secretos ni datos personales innecesarios.
* Verificar el contenido de los reportes antes de compartirlos.
* Reportar comportamientos inesperados al administrador.

---

## 7. Problemas frecuentes

| Situación | Acción sugerida |
| --- | --- |
| No permite iniciar sesión | Verificar usuario, contraseña y código MFA; solicitar apoyo al administrador. |
| No aparece una opción del menú | Consultar si el rol tiene los permisos necesarios. |
| No se guarda un formulario | Revisar campos obligatorios y mensajes de validación. |
| No se encuentra un CVE | Verificar el identificador y la disponibilidad de la consulta externa. |
| Falla una importación | Revisar instrucciones, encabezados, campos obligatorios y log de errores. |
| No se carga una evidencia | Verificar que el plan existe, el archivo es válido y el usuario tiene permisos. |
| No se genera un reporte | Comprobar permisos, filtros y disponibilidad del servicio. |

---

## 8. Nota de validación

Esta versión conserva la información funcional del documento original, con una redacción revisada para mejorar la claridad, la coherencia y la ortografía. Antes de la entrega definitiva, verifique que las capturas correspondan a la versión desplegada y que los pasos descritos puedan reproducirse en el entorno de sustentación.
