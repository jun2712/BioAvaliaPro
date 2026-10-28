import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/auth.ts";

// Public endpoint (no login): the share token authorizes read-only access.
// Never returns private professional notes, owner IDs, or internal fields.
const CAMPOS_AVALIACAO = [
  "id",
  "data",
  "tipo",
  "peso",
  "musculo",
  "idade_corporal",
  "imc",
  "gordura_corporal",
  "gordura_visceral",
  "metabolismo_basal",
  "altura",
  "pescoco",
  "antebraco_direito",
  "antebraco_esquerdo",
  "femur",
  "torax",
  "braco_direito",
  "braco_esquerdo",
  "cintura",
  "abdome",
  "quadril",
  "coxa_direita",
  "coxa_esquerda",
  "panturrilha_direita",
  "panturrilha_esquerda",
  "punho",
  "navy_gordura",
  "navy_massa_gorda",
  "navy_massa_magra",
  "observacoes_cliente",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{8,64}$/.test(token)) {
      return json({ error: "Token inválido" }, 400);
    }

    const admin = adminClient();
    const { data: cliente, error } = await admin
      .from("clientes")
      .select(
        "id,nome,sexo,altura,data_nascimento,meta_proteica,created_by_id,created_date",
      )
      .eq("share_token", token)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) return json({ error: "Relatório não encontrado" }, 404);

    let medidasAtivas: string[] | null = null;
    let mostrarNavy = true;
    if (cliente.created_by_id) {
      const { data: dono } = await admin
        .from("profiles")
        .select("medidas_ativas,mostrar_navy")
        .eq("id", cliente.created_by_id)
        .maybeSingle();
      if (Array.isArray(dono?.medidas_ativas) && dono.medidas_ativas.length) {
        medidasAtivas = dono.medidas_ativas;
      }
      mostrarNavy = dono?.mostrar_navy !== false;
    }

    const { data: avaliacoes, error: avaliacoesError } = await admin
      .from("avaliacoes")
      .select(CAMPOS_AVALIACAO)
      .eq("cliente_id", cliente.id)
      .order("data", { ascending: true })
      .limit(200);
    if (avaliacoesError) throw new Error(avaliacoesError.message);

    return json({
      cliente: {
        nome: cliente.nome,
        sexo: cliente.sexo,
        altura: cliente.altura,
        data_nascimento: cliente.data_nascimento,
        meta_proteica: cliente.meta_proteica || null,
      },
      avaliacoes: avaliacoes || [],
      medidas_ativas: medidasAtivas,
      mostrar_navy: mostrarNavy,
    });
  } catch (error) {
    console.error("getPublicReport", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
