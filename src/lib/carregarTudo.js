import { base44 } from "@/api/base44Client";

// Carrega todos os registros de uma entidade com paginação por cursor:
// listas grandes não ficam truncadas nem estouram o limite de uma chamada.
export async function carregarTudo(entidade, sort = "-updated_date", query = null) {
  const todos = [];
  let cursor;
  do {
    const page = query
      ? await base44.entities[entidade].filter(query, { sort, limit: 1000, cursor })
      : await base44.entities[entidade].list({ sort, limit: 1000, cursor });
    todos.push(...(page.items || []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return todos;
}