import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  API_EVENTOS,
  dataHoraDoEvento,
  listaDe,
  nomeDoTitulo,
  normalizarNome,
  tokenCompartilhado,
} from '../../shared/googleCalendar.ts';

// Traz para o app as mudanças feitas na agenda Google compartilhada.
// Só atua nos agendamentos e no estado de sincronização do Coach logado.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = await tokenCompartilhado(base44).catch(() => '');
    if (!accessToken) return Response.json({ status: 'sem_conexao' });

    const authHeader = { Authorization: `Bearer ${accessToken}` };
    const registros = listaDe(
      await base44.asServiceRole.entities.SyncState.filter({ user_id: user.id }).catch(() => [])
    );
    const registro = registros[0] || null;

    const desde = encodeURIComponent(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    const buscar = (u: string) => fetch(u, { headers: authHeader, signal: AbortSignal.timeout(15000) });

    let url = `${API_EVENTOS}?maxResults=100&singleEvents=true&showDeleted=true`;
    if (registro?.sync_token) url += `&syncToken=${encodeURIComponent(registro.sync_token)}`;
    else url += `&timeMin=${desde}`;

    let resp = await buscar(url);
    if (resp.status === 410) {
      // Token expirado: recomeça pela janela recente
      url = `${API_EVENTOS}?maxResults=100&singleEvents=true&showDeleted=true&timeMin=${desde}`;
      resp = await buscar(url);
    }
    if (!resp.ok) {
      const erro = await resp.json().catch(() => ({}));
      return Response.json(
        { error: erro?.error?.message || 'Falha ao ler o Google Calendar.' },
        { status: 502 }
      );
    }

    const itens: any[] = [];
    let pagina = await resp.json();
    let novoToken: string | null = null;
    for (let i = 0; i < 20; i++) {
      itens.push(...(pagina.items || []));
      if (pagina.nextSyncToken) novoToken = pagina.nextSyncToken;
      if (!pagina.nextPageToken) break;
      const prox = await buscar(`${url}&pageToken=${encodeURIComponent(pagina.nextPageToken)}`);
      if (!prox.ok) break;
      pagina = await prox.json();
    }

    const agendamentos = listaDe(
      await base44.entities.Agendamento.filter({ created_by_id: user.id }, { limit: 500 })
    );
    const porEvento = new Map<string, any>();
    for (const a of agendamentos) if (a.google_event_id) porEvento.set(a.google_event_id, a);

    let atualizados = 0;
    let cancelados = 0;
    let vinculados = 0;

    for (const ev of itens) {
      const ag = porEvento.get(ev.id);
      if (!ag) continue;

      if (ev.status === 'cancelled') {
        if (ag.status !== 'cancelado') {
          await base44.entities.Agendamento.update(ag.id, { status: 'cancelado' });
          cancelados++;
        }
        continue;
      }

      const dh = dataHoraDoEvento(ev);
      if (!dh) continue;
      const mudou = dh.data !== ag.data || dh.hora !== ag.hora;
      const link = ev.htmlLink || ag.google_link || null;
      if (!mudou && link === ag.google_link) continue;

      await base44.entities.Agendamento.update(ag.id, {
        data: dh.data,
        hora: dh.hora,
        google_link: link,
      });
      if (mudou && (ag.tipo === 'avaliacao' || ag.tipo === 'retorno') && ag.cliente_id) {
        await base44.entities.Cliente.update(ag.cliente_id, { proxima_avaliacao: dh.data }).catch(
          () => null
        );
      }
      if (mudou) atualizados++;
    }

    // Eventos do app ainda sem vínculo (criados antes da integração): associa pelo nome no título
    const semVinculo = agendamentos.filter((a) => !a.google_event_id && a.status !== 'cancelado');
    if (itens.length && semVinculo.length) {
      const clientes = listaDe(
        await base44.entities.Cliente.filter({ created_by_id: user.id }, { limit: 500 })
      );
      const idPorNome = new Map<string, string>();
      for (const c of clientes) idPorNome.set(normalizarNome(c.nome), c.id);
      for (const ev of itens) {
        if (ev.status === 'cancelled') continue;
        const dh = dataHoraDoEvento(ev);
        const clienteId = idPorNome.get(normalizarNome(nomeDoTitulo(ev.summary)));
        if (!dh || !clienteId) continue;
        const candidatos = semVinculo.filter((a) => a.cliente_id === clienteId);
        if (candidatos.length !== 1) continue;
        const alvo = candidatos[0];
        await base44.entities.Agendamento.update(alvo.id, {
          data: dh.data,
          hora: dh.hora,
          google_event_id: ev.id,
          google_link: ev.htmlLink || null,
        });
        alvo.google_event_id = ev.id;
        vinculados++;
      }
    }

    if (novoToken) {
      if (registro) {
        await base44.asServiceRole.entities.SyncState.update(registro.id, { sync_token: novoToken });
      } else {
        await base44.asServiceRole.entities.SyncState.create({
          sync_token: novoToken,
          user_id: user.id,
        });
      }
    }

    return Response.json({
      status: 'ok',
      analisados: itens.length,
      atualizados,
      cancelados,
      vinculados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}