import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Gera a análise da anamnese com IA (persona de especialista em bem-estar,
// com sugestões de produtos Herbalife). Somente o coach dono da anamnese.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = body && body.anamnese_id;
    if (typeof id !== 'string' || !/^[a-f0-9]{8,64}$/i.test(id)) {
      return Response.json({ error: 'Requisição inválida' }, { status: 400 });
    }

    const anamnese = await base44.entities.Anamnese.get(id);
    const respondidas = (anamnese.perguntas || [])
      .filter((p) => p.resposta)
      .slice(0, 80)
      .map((p) => `- [${p.codigo}] ${p.pergunta}\n  Resposta: ${String(p.resposta).slice(0, 300)}`);
    if (respondidas.length === 0) {
      return Response.json({ error: 'Esta anamnese ainda não tem respostas para analisar.' }, { status: 400 });
    }

    // Contexto físico: última avaliação de bioimpedância do cliente, se existir.
    let contextoAvaliacao = '';
    if (anamnese.cliente_id) {
      const avsRes = await base44.asServiceRole.entities.Avaliacao.filter(
        { cliente_id: anamnese.cliente_id },
        { sort: '-data', limit: 1 }
      );
      // O filtro com opções devolve uma página ({items}); a lista está dentro dela.
      const avs = Array.isArray(avsRes) ? avsRes : (avsRes && Array.isArray(avsRes.items) ? avsRes.items : []);
      if (avs.length > 0) {
        const a = avs[0];
        const cli = await base44.asServiceRole.entities.Cliente.get(anamnese.cliente_id).catch(() => null);
        const linhas = [
          cli && cli.sexo ? `- Sexo: ${cli.sexo}` : '',
          cli && cli.altura ? `- Altura: ${cli.altura} cm` : '',
          a.data ? `- Data da avaliação: ${a.data}` : '',
          a.peso != null ? `- Peso: ${a.peso} kg` : '',
          a.imc != null ? `- IMC: ${a.imc}` : '',
          a.gordura_corporal != null ? `- Gordura corporal: ${a.gordura_corporal}%` : '',
          a.musculo != null ? `- Músculo: ${a.musculo}%` : '',
          a.gordura_visceral != null ? `- Gordura visceral: nível ${a.gordura_visceral}` : '',
          a.metabolismo_basal != null ? `- Metabolismo basal: ${a.metabolismo_basal} kcal` : '',
          a.idade_corporal != null ? `- Idade corporal: ${a.idade_corporal} anos` : '',
          a.cintura != null ? `- Cintura: ${a.cintura} cm` : '',
          a.abdome != null ? `- Abdome: ${a.abdome} cm` : '',
        ].filter(Boolean).join('\n');
        contextoAvaliacao = '\n\nContexto físico do cliente (última avaliação de bioimpedância):\n' + linhas;
      }
    }

    const nome = anamnese.nome || 'do prospecto';
    const prompt =
      'Você é um especialista em bem-estar, com amplo conhecimento de nutrição, suplementação e medicina básica. ' +
      `Analise as respostas da anamnese abaixo de "${nome}" e escreva uma recomendação personalizada em português do Brasil, com tom acolhedor e motivador, dirigida ao próprio prospecto. ` +
      'Estruture o texto em três partes: ' +
      '1) um resumo empático do perfil e do principal objetivo identificado; ' +
      '2) dicas e recomendações práticas de bem-estar (alimentação, hidratação, sono, atividade física e hábitos) considerando as condições mencionadas; ' +
      '3) sugestões de produtos Herbalife que possam ajudar a alcançar o objetivo, com uma frase curta explicando como cada um se encaixa na rotina (2 a 4 produtos). ' +
      'Regras: baseie-se apenas nas respostas enviadas; não invente dados clínicos; não faça diagnósticos nem promessas de cura; ' +
      'se houver indício de condição de saúde séria, recomende acompanhamento médico; ' +
      'finalize lembrando que a orientação não substitui um profissional de saúde. ' +
      'Formatação OBRIGATÓRIA: escreva em texto puro compatível com WhatsApp — para negrito use exatamente UM asterisco antes e depois da palavra ou frase (ex.: *muito importante*); ' +
      'NUNCA use dois asteriscos (**), sublinhados duplos (__), listas com travessão do markdown nem cerquinhas (###); ' +
      'títulos de seção em MAIÚSCULAS (podem ficar entre asteriscos, ex.: *RECOMENDAÇÕES*); separe as partes com uma linha em branco.\n\n' +
      'Se o contexto físico do cliente for fornecido no final, USE-O: o resumo deve citar explicitamente os dados relevantes (peso, % de gordura, % de músculo, IMC, metabolismo basal, medidas) e as recomendações devem se apoiar nesses números, sem virar uma lista de todos eles.\n' +
      'Respostas da anamnese:\n' + respondidas.join('\n') + contextoAvaliacao;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const recomendacao = typeof resultado === 'string' ? resultado : (resultado && resultado.response) || String(resultado);
    return Response.json({ recomendacao });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}