import { db } from "@/api/dataClient";

// Compara nomes ignorando acentos, espaços extras e maiúsculas/minúsculas
export function normalizarNomeCoach(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Verifica se o nome de Coach já está em uso por outro usuário ou nos registros
// de clientes. A função SQL é security definer e não expõe e-mails/contas.
export async function nomeCoachEmUso(nome, excetoUserId = null) {
  const alvo = normalizarNomeCoach(nome);
  if (!alvo) return false;

  const { data, error } = await db.rpc("coach_name_taken", {
    candidate: nome,
    except_id: excetoUserId,
  });
  if (error) throw error;
  return Boolean(data);
}