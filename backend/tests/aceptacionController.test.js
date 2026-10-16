// Tests de la lógica de validación de aceptarRiesgo (Bloque C, FEAT-003).
// Se mockean las dependencias de BD, auditoría, servicio de vulnerabilidades y fs
// para probar el controlador de forma aislada (patrón de roleMiddleware.test.js).

jest.mock("../src/config/db", () => ({
  queryConRLS: jest.fn(),
  conTransaccionRLS: jest.fn()
}));
jest.mock("../src/utils/auditoriaHelper", () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../src/services/vulnerabilidadService", () => ({
  cambiarEstadoVulnerabilidad: jest.fn().mockResolvedValue({})
}));
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlink: jest.fn((ruta, cb) => cb && cb()),
  existsSync: jest.fn().mockReturnValue(true)
}));

const { queryConRLS, conTransaccionRLS } = require("../src/config/db");
const { aceptarRiesgo } = require("../src/controllers/aceptacionController");

const UUID = "11111111-1111-1111-1111-111111111111";

// Genera un dataURL PNG de un tamaño binario aproximado (en bytes).
const firmaDeBytes = (bytes) =>
  "data:image/png;base64," + Buffer.alloc(Math.max(0, bytes)).toString("base64");

describe("aceptarRiesgo - validaciones de entrada", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      usuario: { id_empresa: UUID, id_usuario: UUID, nombre_completo: "Admin", correo: "admin@acme.com" },
      ip: "127.0.0.1",
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  test("rechaza id_hallazgo ausente o inválido con 400", async () => {
    req.body = { id_hallazgo: "no-uuid", justificacion: "Riesgo asumido", firma: firmaDeBytes(4096) };
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rechaza justificación vacía con 400", async () => {
    req.body = { id_hallazgo: UUID, justificacion: "   ", firma: firmaDeBytes(4096) };
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "La justificación es obligatoria." });
  });

  test("rechaza firma ausente o sin prefijo PNG con 400", async () => {
    req.body = { id_hallazgo: UUID, justificacion: "Riesgo asumido", firma: "no-es-png" };
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rechaza firma demasiado pequeña (canvas en blanco) con 400 'Firma inválida.'", async () => {
    req.body = { id_hallazgo: UUID, justificacion: "Riesgo asumido", firma: firmaDeBytes(200) };
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Firma inválida." });
  });

  test("rechaza fecha_revision en el pasado con 400", async () => {
    req.body = {
      id_hallazgo: UUID,
      justificacion: "Riesgo asumido",
      firma: firmaDeBytes(4096),
      fecha_revision: "2000-01-01"
    };
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "La fecha de revisión debe ser posterior a hoy." });
  });

  test("responde 409 cuando la vulnerabilidad ya está ACEPTADA", async () => {
    req.body = { id_hallazgo: UUID, justificacion: "Riesgo asumido", firma: firmaDeBytes(4096) };
    queryConRLS.mockResolvedValueOnce({
      rows: [{ id_hallazgo: UUID, cve_id: "CVE-2024-0001", estado_hallazgo: "ACEPTADA" }]
    });
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "La vulnerabilidad ya no admite aceptación." });
    expect(conTransaccionRLS).not.toHaveBeenCalled();
  });

  test("responde 404 cuando el hallazgo no existe", async () => {
    req.body = { id_hallazgo: UUID, justificacion: "Riesgo asumido", firma: firmaDeBytes(4096) };
    queryConRLS.mockResolvedValueOnce({ rows: [] });
    await aceptarRiesgo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
