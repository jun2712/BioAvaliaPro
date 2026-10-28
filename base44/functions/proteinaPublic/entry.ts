import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { calcularMetaProteica, NIVEIS_ATIVIDADE, OBJETIVOS, SEXOS } from '../../shared/proteina.ts';

// Endpoint público (sem login): o token do link autoriza ler o formulário e salvar
// as respostas. Nunca expõe dados além do necessário para o próprio cálculo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = body && body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{8,64}$/.test(token)) {
      return Response.json({ error: 'Token inválido' }, { status: 400 });
    }

    const resposta = await base44.asServiceRole.entities.CalculoProteina.filter({ token });
    const lista = Array.isArray(resposta) ? resposta : resposta.items || [];
    const registro = lista[0];
    if (!registro) {
      return Response.json({ error: 'Formulário não encontrado' }, { status: 404 });
    }

    if (body.acao === 'responder') {
      const r = body.respostas;
      if (!r || typeof r !== 'object' || Array.isArray(r)) {
        return Response.json({ error: 'Respostas inválidas' }, { status: 400 });
      }
      const peso = Number(r.peso);
      if (!Number.isFinite(peso) || peso < 25 || peso > 300) {
        return Response.json({ error: 'Peso inválido' }, { status: 400 });
      }
      const idade = Number(r.idade);
      if (!Number.isFinite(idade) || idade < 12 || idade > 110) {
        return Response.json({ error: 'Idade inválida' }, { status: 400 });
      }
      const nivel = String(r.nivel_atividade || '');
      const objetivo = String(r.objetivo || '');
      if (!NIVEIS_ATIVIDADE.includes(nivel) || !OBJETIVOS.includes(objetivo)) {
        return Response.json({ error: 'Responda todas as perguntas' }, { status: 400 });
      }

      const usaGLP1 = r.usa_glp1 === true;
      const sexo = SEXOS.includes(String(r.sexo || '')) ? String(r.sexo) : null;
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

      await base44.asServiceRole.entities.CalculoProteina.update(registro.id, {
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
        status: 'respondida',
        respondida_em: new Date().toISOString(),
      });

      // Mantém a ficha do cliente com a meta proteica mais recente
      if (registro.cliente_id) {
        await base44.asServiceRole.entities.Cliente
          .update(registro.cliente_id, {
            meta_proteica: {
              ...resultado,
              peso,
              idade,
              altura,
              sexo,
              nivel_atividade: nivel,
              objetivo,
              usa_glp1: usaGLP1,
              origem: 'formulario',
              calculado_em: new Date().toISOString(),
            },
          })
          .catch(() => null);
      }

      return Response.json({
        ok: true,
        resultado: { ...resultado, peso, idade },
      });
    }

    return Response.json({
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
        registro.status === 'respondida' && registro.fator != null
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}