import { base44 } from "@/api/base44Client";

// Compara nomes ignorando acentos, espaços extras e maiúsculas/minúsculas
export function normalizarNomeCoach(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Verifica se o nome de Coach já está em uso por outro usuário (coach_nome,
// nome ou e-mail) ou nos registros de clientes — evita sobreposição de clientes.
export async function nomeCoachEmUso(nome, excetoUserId = null) {
  const alvo = normalizarNomeCoach(nome);
  if (!alvo) return false;
  try {
    const usuarios = await base44.entities.User.list();
    for (const u of usuarios) {
      if (excetoUserId && u.id === excetoUserId) continue;
      const nomes = [u.coach_nome, u.full_name, u.email].filter(Boolean).map(normalizarNomeCoach);
      if (nomes.includes(alvo)) return true;
    }
  } catch {
    // Usuários comuns não conseguem listar contas: segue para os registros
  }
  const page = await base44.entities.Cliente.list({ distinct: "coach" });
  return (page.items || []).some((v) => v && normalizarNomeCoach(v) === alvo);
}