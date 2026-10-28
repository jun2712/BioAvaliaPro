import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";

// Generates the anamnesis AI analysis. Only the owner of the anamnesis (or an
// admin) can call it. The LLM provider is selected from Edge Function secrets:
//   GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY
// Optional: AI_PROVIDER=gemini|groq|openrouter, AI_ENABLED=false to disable,
// and GEMINI_MODEL / GROQ_MODEL / OPENROUTER_MODEL.

type Provider = "gemini" | "groq" | "openrouter";

class LlmError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

function providerMessage(data: any, fallback: string) {
  const value = data?.error?.message || data?.error || data?.message;
  return typeof value === "string" ? value : fallback;
}

function provider(): Provider | null {
  const forced = (Deno.env.get("AI_PROVIDER") || "").toLowerCase().trim();
  if (forced === "gemini" || forced === "groq" || forced === "openrouter") return forced;
  if (Deno.env.get("GEMINI_API_KEY")) return "gemini";
  if (Deno.env.get("GROQ_API_KEY")) return "groq";
  if (Deno.env.get("OPENROUTER_API_KEY")) return "openrouter";
  return null;
}

async function chamarLLM(prompt: string): Promise<string> {
  if ((Deno.env.get("AI_ENABLED") || "").toLowerCase() === "false") {
    throw new LlmError("A análise por IA está desativada.", 503);
  }

  const selected = provider();
  if (!selected) {
    throw new LlmError("A análise por IA ainda não foi configurada.", 503);
  }

  if (selected === "gemini") {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new LlmError("GEMINI_API_KEY não configurada.", 503);
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new LlmError(providerMessage(data, "Falha ao chamar a API do Gemini."));
    }
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n").trim()
      : "";
    if (!text) throw new LlmError("O Gemini não retornou uma análise.");
    return text;
  }

  const baseUrl =
    selected === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const key =
    selected === "groq" ? Deno.env.get("GROQ_API_KEY") : Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new LlmError(`Chave da API ${selected} não configurada.`, 503);
  const model =
    selected === "groq"
      ? Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile"
      : Deno.env.get("OPENROUTER_MODEL") || "google/gemini-2.0-flash-001";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (selected === "openrouter") {
    headers["X-Title"] = "BioAvalia";
    const appUrl = Deno.env.get("APP_URL");
    if (appUrl) headers["HTTP-Referer"] = appUrl;
  }

  const resp = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new LlmError(providerMessage(data, "Falha ao chamar a API do provedor de IA."));
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new LlmError("O provedor de IA não retornou uma análise.");
  }
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.anamnese_id;
    const idValido =
      typeof id === "string" &&
      (/^[a-f0-9]{8,64}$/i.test(id) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (!idValido) return json({ error: "Requisição inválida" }, 400);

    // RLS limits this query to the owner or an admin.
    const { data: anamnese, error: anamneseError } = await auth.caller
      .from("anamneses")
      .select("id,cliente_id,nome,perguntas,created_by_id")
      .eq("id", id)
      .maybeSingle();
    if (anamneseError) throw new Error(anamneseError.message);
    if (!anamnese) return json({ error: "Anamnese não encontrada" }, 404);

    const respondidas = (anamnese.perguntas || [])
      .filter((p: any) => p.resposta)
      .slice(0, 80)
      .map((p: any) => `- [${p.codigo}] ${p.pergunta}\n  Resposta: ${String(p.resposta).slice(0, 300)}`);
    if (respondidas.length === 0) {
      return json({ error: "Esta anamnese ainda não tem respostas para analisar." }, 400);
    }

    // Physical context: the client's latest bioimpedance evaluation, if any.
    let contextoAvaliacao = "";
    if (anamnese.cliente_id) {
      const { data: avs } = await auth.admin
        .from("avaliacoes")
        .select(
          "data,peso,imc,gordura_corporal,musculo,gordura_visceral,metabolismo_basal,idade_corporal,cintura,abdome",
        )
        .eq("cliente_id", anamnese.cliente_id)
        .order("data", { ascending: false })
        .limit(1);
      if (avs && avs.length > 0) {
        const a = avs[0];
        const { data: cli } = await auth.admin
          .from("clientes")
          .select("sexo,altura")
          .eq("id", anamnese.cliente_id)
          .maybeSingle();
        const linhas = [
          cli?.sexo ? `- Sexo: ${cli.sexo}` : "",
          cli?.altura ? `- Altura: ${cli.altura} cm` : "",
          a.data ? `- Data da avaliação: ${a.data}` : "",
          a.peso != null ? `- Peso: ${a.peso} kg` : "",
          a.imc != null ? `- IMC: ${a.imc}` : "",
          a.gordura_corporal != null ? `- Gordura corporal: ${a.gordura_corporal}%` : "",
          a.musculo != null ? `- Músculo: ${a.musculo}%` : "",
          a.gordura_visceral != null ? `- Gordura visceral: nível ${a.gordura_visceral}` : "",
          a.metabolismo_basal != null ? `- Metabolismo basal: ${a.metabolismo_basal} kcal` : "",
          a.idade_corporal != null ? `- Idade corporal: ${a.idade_corporal} anos` : "",
          a.cintura != null ? `- Cintura: ${a.cintura} cm` : "",
          a.abdome != null ? `- Abdome: ${a.abdome} cm` : "",
        ]
          .filter(Boolean)
          .join("\n");
        contextoAvaliacao =
          "\n\nContexto físico do cliente (última avaliação de bioimpedância):\n" + linhas;
      }
    }

    const nome = anamnese.nome || "do prospecto";
    const prompt =
      "Você é um especialista em bem-estar, com amplo conhecimento de nutrição, suplementação e medicina básica. " +
      `Analise as respostas da anamnese abaixo de "${nome}" e escreva uma recomendação personalizada em português do Brasil, com tom acolhedor e motivador, dirigida ao próprio prospecto. ` +
      "Estruture o texto em três partes: " +
      "1) um resumo empático do perfil e do principal objetivo identificado; " +
      "2) dicas e recomendações práticas de bem-estar (alimentação, hidratação, sono, atividade física e hábitos) considerando as condições mencionadas; " +
      "3) sugestões de produtos Herbalife que possam ajudar a alcançar o objetivo, com uma frase curta explicando como cada um se encaixa na rotina (2 a 4 produtos). " +
      "Regras: baseie-se apenas nas respostas enviadas; não invente dados clínicos; não faça diagnósticos nem promessas de cura; " +
      "se houver indício de condição de saúde séria, recomende acompanhamento médico; " +
      "finalize lembrando que a orientação não substitui um profissional de saúde. " +
      "Formatação OBRIGATÓRIA: escreva em texto puro compatível com WhatsApp — para negrito use exatamente UM asterisco antes e depois da palavra ou frase (ex.: *muito importante*); " +
      "NUNCA use dois asteriscos (**), sublinhados duplos (__), listas com travessão do markdown nem cerquinhas (###); " +
      "títulos de seção em MAIÚSCULAS (podem ficar entre asteriscos, ex.: *RECOMENDAÇÕES*); separe as partes com uma linha em branco.\n\n" +
      "Se o contexto físico do cliente for fornecido no final, USE-O: o resumo deve citar explicitamente os dados relevantes (peso, % de gordura, % de músculo, IMC, metabolismo basal, medidas) e as recomendações devem se apoiar nesses números, sem virar uma lista de todos eles.\n" +
      "Respostas da anamnese:\n" +
      respondidas.join("\n") +
      contextoAvaliacao;

    const recomendacao = await chamarLLM(prompt);
    return json({ recomendacao });
  } catch (error) {
    console.error("anamneseAnalise", error);
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      error instanceof LlmError ? error.status : 500,
    );
  }
});
