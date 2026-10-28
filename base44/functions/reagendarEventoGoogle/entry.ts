import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  API_EVENTOS,
  intervaloEvento,
  tituloEvento,
  tokenCompartilhado,
} from '../../shared/googleCalendar.ts';

// Reagenda um atendimento: atualiza a data/hora no app e no evento da agenda Google compartilhada.
// Se o evento ainda não existir (ou tiver sido apagado no Google), cria um novo.
// Sem agenda conectada, o reagendamento vale apenas no app.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const agendamento_id = String(body?.agendamento_id || '');
    const data = String(body?.data || '');
    const hora = String(body?.hora || '');
    if (
      !agendamento_id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      return Response.json(
        { error: 'Informe o agendamento, a data (AAAA-MM-DD) e a hora (HH:mm).' },
        { status: 400 }
      );
    }

    const ag = await base44.entities.Agendamento.get(agendamento_id).catch(() => null);
    if (!ag) return Response.json({ error: 'Agendamento não encontrado.' }, { status: 404 });

    const cliente = ag.cliente_id
      ? await base44.entities.Cliente.get(ag.cliente_id).catch(() => null)
      : null;
    const resumo = tituloEvento(cliente?.nome || 'Cliente');
    const horarios = intervaloEvento(data, hora);

    let eventId = ag.google_event_id || '';
    let link = ag.google_link || '';
    let aviso = '';

    const accessToken = await tokenCompartilhado(base44).catch(() => '');
    if (accessToken) {
      try {
        const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
        const criar = async () => {
          const resp = await fetch(API_EVENTOS, {
            method: 'POST',
            headers,
            body: JSON.stringify({ summary: resumo, ...horarios }),
            signal: AbortSignal.timeout(15000),
          });
          const ev = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(ev?.error?.message || 'Falha ao criar o evento no Google Calendar.');
          return ev;
        };

        if (eventId) {
          const resp = await fetch(`${API_EVENTOS}/${encodeURIComponent(eventId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ summary: resumo, ...horarios }),
            signal: AbortSignal.timeout(15000),
          });
          const ev = await resp.json().catch(() => ({}));
          if (resp.ok) {
            eventId = ev.id || eventId;
            link = ev.htmlLink || link;
          } else if (resp.status === 404 || resp.status === 410) {
            // Evento removido no Google: recria para manter os dois lados iguais
            const novo = await criar();
            eventId = novo.id;
            link = novo.htmlLink || '';
          } else {
            aviso = ev?.error?.message || 'Falha ao atualizar o evento no Google Calendar.';
          }
        } else {
          const novo = await criar();
          eventId = novo.id;
          link = novo.htmlLink || '';
        }
      } catch (e) {
        aviso = e?.message || 'Falha ao falar com o Google Calendar.';
      }
    }

    await base44.entities.Agendamento.update(ag.id, {
      data,
      hora,
      google_event_id: eventId || null,
      google_link: link || null,
    });
    if (cliente && (ag.tipo === 'avaliacao' || ag.tipo === 'retorno')) {
      await base44.entities.Cliente.update(cliente.id, { proxima_avaliacao: data });
    }

    return Response.json({
      ok: true,
      vinculado: !!accessToken,
      google_event_id: eventId || null,
      html_link: link || null,
      aviso: aviso || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}