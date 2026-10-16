// Pruebas del handler asignarRemediador (Bloque B / FEAT-002).
// Mockea las dependencias externas (BD, notificación, correo, auditoría) siguiendo el
// patrón de roleMiddleware.test.js, y verifica los cuatro escenarios del endpoint más
// la garantía best-effort del correo.

jest.mock("../src/config/db", () => ({
  queryConRLS: jest.fn(),
  pool: {},
  conTransaccionRLS: jest.fn()
}));
jest.mock("../src/utils/notificacionHelper", () => ({
  crearNotificacion: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../src/services/emailService", () => ({
  enviarCorreo: jest.fn().mockResolvedValue({ ok: true })
}));
jest.mock("../src/utils/auditoriaHelper", () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined)
}));
// Dependencias no usadas por asignarRemediador pero requeridas por el módulo del controlador.
jest.mock("../src/services/vulnerabilidadService", () => ({
  cambiarEstadoVulnerabilidad: jest.fn()
}));
jest.mock("../src/services/remediacionService", () => ({
  crearPlanAutomatico: jest.fn()
}));

const { queryConRLS } = require("../src/config/db");
const { crearNotificacion } = require("../src/utils/notificacionHelper");
const { enviarCorreo } = require("../src/services/emailService");
const { registrarAuditoria } = require("../src/utils/auditoriaHelper");
const { asignarRemediador } = require("../src/controllers/remediacionController");

describe("asignarRemediador (PATCH /api/remediacion/:id/asignar)", () => {
  let req;
  let res;

  const ID_PLAN = "11111111-1111-1111-1111-111111111111";
  const ID_REMEDIADOR = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      usuario: { id_empresa: "emp-1", id_usuario: "admin-1" },
      params: { id: ID_PLAN },
      body: { id_remediador: ID_REMEDIADOR },
      ip: "127.0.0.1"
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test("400 cuando falta id_remediador", async () => {
    req.body = {};
    await asignarRemediador(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Debe indicar el responsable (id_remediador)." });
    expect(queryConRLS).not.toHaveBeenCalled();
  });

  test("400 cuando el usuario no existe o su rol no es apto", async () => {
    // Usuario existe pero con rol no apto (CONSULTA)
    queryConRLS.mockResolvedValueOnce({ rows: [{ id_usuario: ID_REMEDIADOR, correo: "x@x.com", rol: "CONSULTA" }] });
    await asignarRemediador(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "El usuario no puede ser responsable de remediación." });
    // No debe intentar el UPDATE del plan
    expect(queryConRLS).toHaveBeenCalledTimes(1);
  });

  test("404 cuando el plan no existe o está cerrado", async () => {
    queryConRLS
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_REMEDIADOR, correo: "rem@x.com", rol: "REMEDIADOR" }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [] }); // UPDATE 0 filas
    await asignarRemediador(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Plan no encontrado o ya cerrado." });
    expect(crearNotificacion).not.toHaveBeenCalled();
  });

  test("200 en asignación exitosa con notificación, correo y auditoría", async () => {
    const planActualizado = { id_plan: ID_PLAN, nombre: "Parcheo crítico", fecha_limite: "2025-12-31" };
    const planConResponsable = { ...planActualizado, responsable: "Remediador Uno" };
    queryConRLS
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_REMEDIADOR, correo: "rem@x.com", rol: "REMEDIADOR" }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [planActualizado] }) // UPDATE
      .mockResolvedValueOnce({ rows: [planConResponsable] }); // SELECT_PLAN re-consulta

    await asignarRemediador(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(planConResponsable);
    expect(crearNotificacion).toHaveBeenCalledWith("emp-1", expect.objectContaining({
      id_usuario: ID_REMEDIADOR, tipo: "PLAN_ASIGNADO", recurso: "plan", id_recurso: ID_PLAN
    }));
    expect(enviarCorreo).toHaveBeenCalledWith("rem@x.com", expect.any(String), expect.any(String));
    expect(registrarAuditoria).toHaveBeenCalledWith(
      "emp-1", "admin-1", "REMEDIATION_ASSIGNED", "Remediación",
      expect.objectContaining({ id_remediador: ID_REMEDIADOR }), "127.0.0.1",
      expect.objectContaining({ recurso: "plan", id_recurso: ID_PLAN })
    );
  });

  test("sigue respondiendo 200 aunque el envío de correo falle", async () => {
    const planActualizado = { id_plan: ID_PLAN, nombre: "Parcheo crítico", fecha_limite: "2025-12-31" };
    queryConRLS
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_REMEDIADOR, correo: "rem@x.com", rol: "ADMINISTRADOR" }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [planActualizado] }) // UPDATE
      .mockResolvedValueOnce({ rows: [planActualizado] }); // SELECT_PLAN
    // enviarCorreo captura su propio error y devuelve {ok:false}; el handler lo ignora.
    enviarCorreo.mockResolvedValueOnce({ ok: false, error: "SMTP caído" });

    await asignarRemediador(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(planActualizado);
  });
});
