import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  API_EVENTOS,
  intervaloEvento,
  tituloEvento,
  tokenCompartilhado,
} from '../../shared/googleCalendar.ts';

// Cria o evento "Avaliação Agendada" na agenda Google compartilhada do app.
// Sem agenda conectada o agendamento continua existindo apenas no app.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cliente_id = String(body?.cliente_id || '');
    const data = String(body?.data || '');
    const hora = String(body?.hora || '');
    if (!cliente_id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return Response.json(
        { error: 'Informe cliente, data (AAAA-MM-DD) e hora (HH:mm).' },
        { status: 400 }
      );
    }

    const cliente = await base44.entities.Cliente.get(cliente_id).catch(() => null);
    if (!cliente) return Response.json({ error: 'Cliente não encontrado.' }, { status: 404 });

    const accessToken = await tokenCompartilhado(base44).catch(() => '');
    if (!accessToken) {
      return Response.json({
        vinculado: false,
        motivo: 'sem_conexao',
        aviso: 'A agenda Google compartilhada não está conectada.',
      });
    }

    const resp = await fetch(API_EVENTOS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: tituloEvento(cliente.nome || 'Cliente'),
        ...intervaloEvento(data, hora),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const ev = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return Response.json(
        { error: ev?.error?.message || 'Falha ao criar o evento no Google Calendar.' },
        { status: 502 }
      );
    }
    return Response.json({ vinculado: true, event_id: ev.id, html_link: ev.htmlLink });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}