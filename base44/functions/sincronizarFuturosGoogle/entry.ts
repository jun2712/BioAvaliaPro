import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  API_EVENTOS,
  hojeBrasilia,
  intervaloEvento,
  listaDe,
  tituloEvento,
  tokenCompartilhado,
} from '../../shared/googleCalendar.ts';

// Cria na agenda Google compartilhada os eventos dos agendamentos futuros que ainda
// estão apenas no app. Administrador envia todos; Coach envia apenas os seus.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = await tokenCompartilhado(base44).catch(() => '');
    if (!accessToken) {
      return Response.json(
        {
          error:
            'A agenda Google compartilhada não está conectada. Peça ao administrador para ativá-la.',
        },
        { status: 400 }
      );
    }

    const hoje = hojeBrasilia();
    const filtro = user.role === 'admin' ? {} : { created_by_id: user.id };
    const agendamentos = listaDe(
      await base44.entities.Agendamento.filter(filtro, { limit: 500 })
    );
    const pendentes = agendamentos.filter(
      (a) => a.status !== 'cancelado' && a.data >= hoje && !a.google_event_id
    );
    if (!pendentes.length) return Response.json({ ok: true, criados: 0, falhas: 0 });

    const ids = [...new Set(pendentes.map((a) => a.cliente_id).filter(Boolean))];
    const clientes = ids.length
      ? listaDe(await base44.entities.Cliente.filter({ id: { $in: ids } }, { limit: 200 }))
      : [];
    const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]));

    let criados = 0;
    let falhas = 0;
    for (let i = 0; i < pendentes.length; i += 6) {
      const lote = pendentes.slice(i, i + 6);
      await Promise.allSettled(
        lote.map(async (a) => {
          const resp = await fetch(API_EVENTOS, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: tituloEvento(nomePorId.get(a.cliente_id) || 'Cliente'),
              ...intervaloEvento(a.data, a.hora || '09:00'),
            }),
            signal: AbortSignal.timeout(15000),
          }).catch(() => null);
          const ev = resp ? await resp.json().catch(() => ({})) : {};
          if (!resp || !resp.ok || !ev?.id) {
            falhas++;
            return;
          }
          await base44.entities.Agendamento.update(a.id, {
            google_event_id: ev.id,
            google_link: ev.htmlLink || null,
          });
          criados++;
        })
      );
    }

    return Response.json({ ok: true, criados, falhas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}