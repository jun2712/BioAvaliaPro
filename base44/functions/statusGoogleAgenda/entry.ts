import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  API_EVENTOS,
  hojeBrasilia,
  listaDe,
  tokenCompartilhado,
} from '../../shared/googleCalendar.ts';

// Estado da agenda Google compartilhada e quantos agendamentos futuros ainda não
// têm evento criado no Google. Administrador vê a base inteira; Coach vê os seus.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = await tokenCompartilhado(base44).catch(() => '');
    if (!accessToken) return Response.json({ conectado: false, futuros_sem_evento: 0 });

    // A conta conectada é identificada pelo próprio calendário primário
    const resp = await fetch(`${API_EVENTOS}?maxResults=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return Response.json({ conectado: false, futuros_sem_evento: 0 });
    const calendario = await resp.json().catch(() => ({}));

    const hoje = hojeBrasilia();
    const filtro = user.role === 'admin' ? {} : { created_by_id: user.id };
    const agendamentos = listaDe(
      await base44.entities.Agendamento.filter(filtro, { limit: 500 })
    );
    const futuros_sem_evento = agendamentos.filter(
      (a) => a.status !== 'cancelado' && a.data >= hoje && !a.google_event_id
    ).length;

    return Response.json({
      conectado: true,
      email: calendario?.summary || '',
      futuros_sem_evento,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}