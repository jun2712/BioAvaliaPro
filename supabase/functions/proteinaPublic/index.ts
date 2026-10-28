import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/auth.ts";
import {
  calcularMetaProteica,
  NIVEIS_ATIVIDADE,
  OBJETIVOS,
  SEXOS,
} from "../_shared/proteina.ts";

// Public endpoint (no login): the link token authorizes reading the form and
// saving the answers. It never exposes data beyond the calculation itself.
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
    const { data: registro, error } = await admin
      .from("calculos_proteina")
      .select(
        "id,cliente_id,nome,status,sexo,idade,peso,altura,nivel_atividade,objetivo,usa_glp1,fator,gramas_dia,refeicao_min,refeicao_max,refeicoes",
      )
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!registro) return json({ error: "Formulário não encontrado" }, 404);

    if (body.acao === "responder") {
      const r = body.respostas;
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        return json({ error: "Respostas inválidas" }, 400);
      }

      const peso = Number(r.peso);
      if (!Number.isFinite(peso) || peso < 25 || peso > 300) {
        return json({ error: "Peso inválido" }, 400);
      }
      const idade = Number(r.idade);
      if (!Number.isFinite(idade) || idade < 12 || idade > 110) {
        return json({ error: "Idade inválida" }, 400);
      }
      const nivel = String(r.nivel_atividade || "");
      const objetivo = String(r.objetivo || "");
      if (
        !(NIVEIS_ATIVIDADE as readonly string[]).includes(nivel) ||
        !(OBJETIVOS as readonly string[]).includes(objetivo)
      ) {
        return json({ error: "Responda todas as perguntas" }, 400);
      }

      const usaGLP1 = r.usa_glp1 === true;
      const sexo = (SEXOS as readonly string[]).includes(String(r.sexo || ""))
        ? String(r.sexo)
        : null;
      const alturaInformada = Number(r.altura);
      const altura =
        Number.isFinite(alturaInformada) && alturaInformada >= 100 && alturaInformada <= 250
          ? Math.round(alturaInformada)
          : null;

      const resultado = calcularMetaProteica({
        peso,
        idade,
        nivelAtividade: nivel,
        objetivo,
        usaGLP1,
      });
      const respondidaEm = new Date().toISOString();

      const { error: updateError } = await admin
        .from("calculos_proteina")
        .update({
          peso,
          idade,
          altura,
          sexo,
          nivel_atividade: nivel,
          objetivo,
          usa_glp1: usaGLP1,
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          status: "respondida",
          respondida_em: respondidaEm,
        })
        .eq("id", registro.id);
      if (updateError) throw new Error(updateError.message);

      // Keep the client's latest protein target in sync.
      if (registro.cliente_id) {
        const { error: clienteError } = await admin
          .from("clientes")
          .update({
            meta_proteica: {
              ...resultado,
              peso,
              idade,
              altura,
              sexo,
              nivel_atividade: nivel,
              objetivo,
              usa_glp1: usaGLP1,
              origem: "formulario",
              calculado_em: respondidaEm,
            },
          })
          .eq("id", registro.cliente_id);
        if (clienteError) {
          console.error("proteinaPublic cliente update", clienteError.message);
        }
      }

      return json({
        ok: true,
        resultado: { ...resultado, peso, idade },
      });
    }

    return json({
      nome: registro.nome,
      status: registro.status,
      sexo: registro.sexo ?? null,
      idade: registro.idade ?? null,
      peso: registro.peso ?? null,
      altura: registro.altura ?? null,
      nivel_atividade: registro.nivel_atividade ?? null,
      objetivo: registro.objetivo ?? null,
      usa_glp1: registro.usa_glp1 ?? null,
      resultado:
        registro.status === "respondida" && registro.fator != null
          ? {
              fator: registro.fator,
              gramas_dia: registro.gramas_dia ?? null,
              refeicao_min: registro.refeicao_min ?? null,
              refeicao_max: registro.refeicao_max ?? null,
              refeicoes: registro.refeicoes ?? null,
              peso: registro.peso ?? null,
              idade: registro.idade ?? null,
            }
          : null,
    });
  } catch (error) {
    console.error("proteinaPublic", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
