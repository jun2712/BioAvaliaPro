import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/auth.ts";
import {
  calcularMetaProteica,
  extrairDadosMetaProteica,
  novoToken,
  ROTULO_OBJETIVO,
} from "../_shared/proteina.ts";

// Public endpoint (no login): the token authorizes reading the anamnesis and
// saving the responses. When the "Meta Proteica" group is answered, the
// calculation is saved to the client record or to a new prospect.
async function nomeDoCoach(admin: ReturnType<typeof adminClient>, userId: string | null) {
  if (!userId) return null;
  const { data } = await admin
    .from("profiles")
    .select("coach_nome,full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.coach_nome || data?.full_name || null;
}

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
    const { data: anamnese, error } = await admin
      .from("anamneses")
      .select("id,cliente_id,nome,whatsapp,status,perguntas,meta_proteica,created_by_id,created_date")
      .eq("token", token)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!anamnese) return json({ error: "Anamnese não encontrada" }, 404);

    if (body.acao === "responder") {
      const respostas = body.respostas;
      if (!respostas || typeof respostas !== "object" || Array.isArray(respostas)) {
        return json({ error: "Respostas inválidas" }, 400);
      }

      const mapa: Record<string, string> = {};
      Object.keys(respostas).forEach((cod) => {
        const valor = respostas[cod];
        if (typeof valor === "string" && valor.trim().length > 0 && valor.length <= 500) {
          mapa[cod] = valor.trim();
        }
      });
      if (Object.keys(mapa).length === 0) {
        return json({ error: "Nenhuma resposta informada" }, 400);
      }

      const perguntas = (anamnese.perguntas || []).map((p: any) => ({
        ...p,
        resposta: mapa[p.codigo] ?? null,
      }));

      // Protein target calculation only happens when the group was answered.
      const dados = extrairDadosMetaProteica(mapa);
      let metaProteica: Record<string, unknown> | null = null;
      let clienteVinculado: { id: string; nome: string; prospecto: boolean } | null = null;
      const agora = new Date().toISOString();

      if (dados) {
        const resultado = calcularMetaProteica(dados);
        const coach = await nomeDoCoach(admin, anamnese.created_by_id);
        const metaCliente = {
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          peso: dados.peso,
          idade: dados.idade,
          altura: dados.altura,
          sexo: dados.sexo,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          origem: "anamnese",
          calculado_em: agora,
        };

        let clienteId = anamnese.cliente_id || null;
        let prospecto = false;

        if (clienteId) {
          const { data: cliente } = await admin
            .from("clientes")
            .select("id,sexo,altura")
            .eq("id", clienteId)
            .maybeSingle();
          if (!cliente) clienteId = null;
          else {
            const patch: Record<string, unknown> = { meta_proteica: metaCliente };
            if (!cliente.sexo) patch.sexo = dados.sexo;
            if (!cliente.altura) patch.altura = dados.altura;
            const { error: clienteError } = await admin
              .from("clientes")
              .update(patch)
              .eq("id", cliente.id);
            if (clienteError) console.error("anamnesePublic cliente update", clienteError.message);
          }
        }

        if (!clienteId) {
          const { data: novoCliente, error: createError } = await admin
            .from("clientes")
            .insert({
              nome: String(anamnese.nome || "Prospecto").trim() || "Prospecto",
              whatsapp: anamnese.whatsapp || null,
              sexo: dados.sexo,
              altura: dados.altura,
              coach: coach || null,
              status: "prospecto",
              objetivo: ROTULO_OBJETIVO[dados.objetivo] || null,
              meta_proteica: metaCliente,
              created_by_id: anamnese.created_by_id || null,
            })
            .select("id")
            .single();
          if (createError) throw new Error(createError.message);
          clienteId = novoCliente.id;
          prospecto = true;
        }

        metaProteica = {
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          peso: dados.peso,
          idade: dados.idade,
          altura: dados.altura,
          sexo: dados.sexo,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          cliente_vinculado: clienteId,
          prospecto_criado: prospecto,
        };

        const { error: calculoError } = await admin.from("calculos_proteina").insert({
          cliente_id: clienteId,
          nome: anamnese.nome || null,
          whatsapp: anamnese.whatsapp || null,
          coach: coach || null,
          token: novoToken(),
          status: "respondida",
          sexo: dados.sexo,
          idade: dados.idade,
          peso: dados.peso,
          altura: dados.altura,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          respondida_em: agora,
          created_by_id: anamnese.created_by_id || null,
        });
        if (calculoError) console.error("anamnesePublic calculo insert", calculoError.message);

        clienteVinculado = {
          id: clienteId,
          nome: String(anamnese.nome || "Prospecto"),
          prospecto,
        };
      }

      const patch: Record<string, unknown> = {
        perguntas,
        status: "respondida",
        respondida_em: agora,
        meta_proteica: metaProteica,
      };
      if (clienteVinculado) patch.cliente_id = clienteVinculado.id;

      const { error: updateError } = await admin
        .from("anamneses")
        .update(patch)
        .eq("id", anamnese.id);
      if (updateError) throw new Error(updateError.message);

      return json({ ok: true, meta_proteica: metaProteica, cliente: clienteVinculado });
    }

    return json({
      nome: anamnese.nome,
      status: anamnese.status,
      meta_proteica: anamnese.meta_proteica || null,
      perguntas: (anamnese.perguntas || []).map((p: any) => ({
        codigo: p.codigo,
        categoria: p.categoria,
        pergunta: p.pergunta,
        tipo: p.tipo,
        opcoes: Array.isArray(p.opcoes) ? p.opcoes : [],
        resposta: p.resposta || "",
      })),
    });
  } catch (error) {
    console.error("anamnesePublic", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
