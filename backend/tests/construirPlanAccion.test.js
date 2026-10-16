
const { construirPlanAccion } = require("../src/services/remediacionService");

describe("construirPlanAccion", () => {
  test("genera las 5 secciones en espanol", () => {
    const plan = construirPlanAccion({
      cve_id: "CVE-2024-0001",
      cvss: 9.8,
      severidad: "CRITICA",
      descripcion: "Ejecucion remota de codigo.",
      referencias: ["https://nvd.nist.gov/vuln/detail/CVE-2024-0001"],
      codigo_activo: "SRV-01",
      activo_nombre: "Servidor web",
      direccion_ip: "10.0.0.5"
    });

    expect(plan).toContain("## OBJETIVO");
    expect(plan).toContain("## DESCRIPCION DEL PROBLEMA");
    expect(plan).toContain("## TAREAS SUGERIDAS");
    expect(plan).toContain("## PLAZO (SLA)");
    expect(plan).toContain("## REFERENCIAS");
  });

  test("checklist estandar de 6 tareas", () => {
    const plan = construirPlanAccion({ cve_id: "CVE-2024-0002", severidad: "ALTA" });
    const tareas = plan.split("\n").filter((l) => l.startsWith("- [ ]"));
    expect(tareas).toHaveLength(6);
  });

  test("con cvss presente muestra el valor numerico", () => {
    const plan = construirPlanAccion({ cve_id: "CVE-1", cvss: 7.5, severidad: "ALTA" });
    expect(plan).toContain("CVSS 7.5");
  });

  test("sin cvss muestra N/D (null y undefined)", () => {
    const conNull = construirPlanAccion({ cve_id: "CVE-1", cvss: null, severidad: "MEDIA" });
    const sinCampo = construirPlanAccion({ cve_id: "CVE-1", severidad: "MEDIA" });
    expect(conNull).toContain("CVSS N/D");
    expect(sinCampo).toContain("CVSS N/D");
  });

  test("con descripcion usa el texto del hallazgo", () => {
    const plan = construirPlanAccion({ cve_id: "CVE-1", descripcion: "Fuga de memoria." });
    expect(plan).toContain("Fuga de memoria.");
  });

  test("sin descripcion usa el marcador de enriquecimiento NVD", () => {
    const vacia = construirPlanAccion({ cve_id: "CVE-1", descripcion: "   " });
    const ausente = construirPlanAccion({ cve_id: "CVE-1" });
    expect(vacia).toContain("Pendiente de enriquecimiento NVD");
    expect(ausente).toContain("Pendiente de enriquecimiento NVD");
  });

  test("normaliza referencias como objetos con .url", () => {
    const plan = construirPlanAccion({
      cve_id: "CVE-1",
      referencias: [{ url: "https://ejemplo.com/a" }, { url: "https://ejemplo.com/b" }]
    });
    expect(plan).toContain("- https://ejemplo.com/a");
    expect(plan).toContain("- https://ejemplo.com/b");
  });

  test("normaliza referencias como strings y filtra vacios", () => {
    const plan = construirPlanAccion({
      cve_id: "CVE-1",
      referencias: ["https://ejemplo.com/x", "", null]
    });
    expect(plan).toContain("- https://ejemplo.com/x");
  });

  test("sin referencias muestra el mensaje por defecto", () => {
    const vacias = construirPlanAccion({ cve_id: "CVE-1", referencias: [] });
    const invalidas = construirPlanAccion({ cve_id: "CVE-1", referencias: "no-array" });
    expect(vacias).toContain("Sin referencias NVD disponibles.");
    expect(invalidas).toContain("Sin referencias NVD disponibles.");
  });

  test("omite el fragmento de IP cuando no hay direccion_ip", () => {
    const sinIp = construirPlanAccion({ cve_id: "CVE-1", codigo_activo: "SRV-02" });
    const conIp = construirPlanAccion({ cve_id: "CVE-1", codigo_activo: "SRV-02", direccion_ip: "192.168.1.1" });
    expect(sinIp).not.toContain("(IP");
    expect(conIp).toContain("(IP 192.168.1.1)");
  });
});
