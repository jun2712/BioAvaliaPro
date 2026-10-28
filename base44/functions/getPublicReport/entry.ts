import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Endpoint público (sem login): o token de compartilhamento autoriza a leitura.
// Nunca retorna as notas privadas do profissional.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = body && body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{8,64}$/.test(token)) {
      return Response.json({ error: 'Token inválido' }, { status: 400 });
    }

    const clientes = await base44.asServiceRole.entities.Cliente.filter({ share_token: token }, '-created_date', 1);
    const cliente = clientes[0];
    if (!cliente) {
      return Response.json({ error: 'Relatório não encontrado' }, { status: 404 });
    }

    // Medidas ativas e preferências do coach dono do cliente: o relatório
    // público segue a configuração dele.
    let medidasAtivas = null;
    let mostrarNavy = true;
    try {
      const dono = await base44.asServiceRole.entities.User.get(cliente.created_by_id);
      if (Array.isArray(dono?.medidas_ativas) && dono.medidas_ativas.length) {
        medidasAtivas = dono.medidas_ativas;
      }
      mostrarNavy = dono?.mostrar_navy !== false;
    } catch (e) {
      // sem configuração do dono, mostra todas as medidas
    }

    const avaliacoes = await base44.asServiceRole.entities.Avaliacao.filter({ cliente_id: cliente.id }, 'data', 200);
    const publicas = avaliacoes.map((a) => {
      const { notas_profissional, ...resto } = a;
      return resto;
    });

    return Response.json({
      cliente: {
        nome: cliente.nome,
        sexo: cliente.sexo,
        altura: cliente.altura,
        data_nascimento: cliente.data_nascimento,
        meta_proteica: cliente.meta_proteica || null,
      },
      avaliacoes: publicas,
      medidas_ativas: medidasAtivas,
      mostrar_navy: mostrarNavy,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}