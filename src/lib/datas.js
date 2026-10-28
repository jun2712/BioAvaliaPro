// Datas no formato "YYYY-MM-DD" devem ser interpretadas no fuso local,
// evitando o deslocamento de um dia causado pelo parse em UTC.
export function parseDataLocal(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(str);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatarDataBR(str) {
  const d = parseDataLocal(str);
  if (!d || isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR");
}

export function dataHojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}