import { base44 } from "@/api/base44Client";
import { carregarTudo } from "@/lib/carregarTudo";

// ID interno do cliente, sequencial e legível (ex.: C0001).
export const formatarCodigo = (n) => `C${String(n).padStart(4, "0")}`;

// Número embutido no código, aceitando os prefixos já usados (J0401 → 401).
const numeroDoCodigo = (codigo) => {
  const digitos = String(codigo || "").replace(/\D/g, "");
  return digitos ? Number(digitos) : 0;
};

const codigoNormalizado = (v) => String(v ?? "").trim().toUpperCase();

// Próximo código livre considerando a lista informada: parte do MAIOR código
// já atribuído e nunca reaproveita IDs de clientes excluídos.
export function proximoCodigo(clientes = []) {
  const usados = new Set(clientes.map((c) => codigoNormalizado(c.codigo)).filter(Boolean));
  let maximo = clientes.reduce((acc, c) => Math.max(acc, numeroDoCodigo(c.codigo)), 0);
  let n = maximo + 1;
  while (usados.has(formatarCodigo(n))) n += 1;
  return formatarCodigo(n);
}

// Conjunto de todos os códigos já registrados no app. A consulta "distinct" é
// limitada, por isso a base é percorrida por completo na paginação.
async function codigosUsados() {
  const clientes = await carregarTudo("Cliente", "codigo");
  return new Set(clientes.map((c) => codigoNormalizado(c.codigo)).filter(Boolean));
}

// Gera um código novo, único no app: segue a sequência a partir do maior ID
// histórico (clientes excluídos não têm seus IDs reutilizados).
export async function codigoUnico() {
  const usados = await codigosUsados();
  let maximo = 0;
  for (const v of usados) maximo = Math.max(maximo, numeroDoCodigo(v));
  let n = maximo + 1;
  while (usados.has(formatarCodigo(n))) n += 1;
  return formatarCodigo(n);
}

// Garante o ID interno apenas de quem ainda não tem: os códigos existentes
// nunca são reescritos (a lista recebida é a base completa).
export async function garantirCodigos(clientes) {
  const semCodigo = clientes.filter((c) => !codigoNormalizado(c.codigo));
  if (!semCodigo.length) return;
  const usados = new Set(clientes.map((c) => codigoNormalizado(c.codigo)).filter(Boolean));
  let maximo = clientes.reduce((acc, c) => Math.max(acc, numeroDoCodigo(c.codigo)), 0);
  const updates = [];
  for (const c of semCodigo) {
    let n = maximo + 1;
    while (usados.has(formatarCodigo(n))) n += 1;
    const codigo = formatarCodigo(n);
    maximo = n;
    usados.add(codigo);
    updates.push({ id: c.id, codigo });
  }
  for (let i = 0; i < updates.length; i += 500) {
    await base44.entities.Cliente.bulkUpdate(updates.slice(i, i + 500));
  }
  updates.forEach((u) => {
    const c = clientes.find((x) => x.id === u.id);
    if (c) c.codigo = u.codigo;
  });
}