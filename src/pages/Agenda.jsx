import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/AppShell";
import CalendarioTresSemanas from "@/components/agenda/CalendarioTresSemanas";
import ListaDoDia from "@/components/agenda/ListaDoDia";
import ReagendarDialog from "@/components/agenda/ReagendarDialog";
import GoogleAgendaAviso from "@/components/agenda/GoogleAgendaAviso";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, CalendarClock, BellRing } from "lucide-react";
import { parseDataLocal } from "@/lib/datas";
import { linkWhatsApp } from "@/lib/whatsapp";

const MSG_ANIVERSARIO = "Feliz aniversário, {nome}! 🎉 Muita saúde, energia e conquistas nesse novo ciclo. Conta comigo nessa jornada!";
const CHAVE_ANIV = "bioavalia_msg_aniversario";
const MSG_LEMBRETE = "Olá, {nome}! Passando para confirmar sua avaliação agendada para amanhã às {hora}. Tudo certo para o horário?";
const CHAVE_LEMB = "bioavalia_msg_lembrete";

const chaveDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const chaveMesDia = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function Agenda() {
  const [clientes, setClientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgAniv, setMsgAniv] = useState(() => localStorage.getItem(CHAVE_ANIV) || MSG_ANIVERSARIO);
  const [msgLemb, setMsgLemb] = useState(() => localStorage.getItem(CHAVE_LEMB) || MSG_LEMBRETE);
  const [selecionada, setSelecionada] = useState(() => chaveDia(new Date()));
  const [reagendar, setReagendar] = useState(null);

  const carregar = async () => {
    const [cls, ags] = await Promise.all([
      base44.entities.Cliente.list("-updated_date", 500),
      base44.entities.Agendamento.list("data", 500),
    ]);
    setClientes(cls);
    setAgendamentos(ags);
  };

  useEffect(() => {
    (async () => {
      try {
        await carregar();
      } finally {
        setLoading(false);
      }
      // Traz para o app as mudanças de data/hora feitas direto no Google Calendar
      try {
        const res = await base44.functions.invoke("sincronizarAgendaGoogle", {});
        const mudou =
          (res.data?.atualizados || 0) + (res.data?.cancelados || 0) + (res.data?.vinculados || 0);
        if (mudou > 0) await carregar();
      } catch {
        /* sem conexão com o Google: segue com os dados do app */
      }
    })();
  }, []);

  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const chAmanha = chaveDia(amanha);

  const ativos = agendamentos.filter((a) => a.status !== "cancelado");
  const agendadosAmanha = ativos.filter((a) => a.data === chAmanha);

  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const nomeDe = (a) => a.nome || clientePorId.get(a.cliente_id)?.nome || "Cliente";
  const whatsappDe = (a) => clientePorId.get(a.cliente_id)?.whatsapp || "";

  const aniversariantesSelecionada = clientes.filter((c) => {
    const d = c.data_nascimento && parseDataLocal(c.data_nascimento);
    return !!d && chaveMesDia(d) === selecionada.slice(5);
  });
  const agendadosSelecionada = ativos
    .filter((a) => a.data === selecionada)
    .map((a) => ({ ...a, nome: nomeDe(a) }));

  const tituloDia = capitalizar(
    new Date(`${selecionada}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
  );

  const enviarParabens = (c) => {
    const msg = msgAniv.replace(/\{nome\}/g, c.nome.split(" ")[0]);
    window.open(linkWhatsApp(c.whatsapp, encodeURIComponent(msg)), "_blank");
  };

  const enviarLembrete = (a) => {
    const primeiroNome = nomeDe(a).split(" ")[0];
    const msg = msgLemb.replace(/\{nome\}/g, primeiroNome).replace(/\{hora\}/g, a.hora || "");
    window.open(linkWhatsApp(whatsappDe(a), encodeURIComponent(msg)), "_blank");
  };

  return (
    <AppShell title="Agenda" subtitle="Atendimentos e aniversários do dia">
      <GoogleAgendaAviso onMudou={carregar} />
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start mb-6">
        <CalendarioTresSemanas
          aniversarios={new Set(
            clientes
              .map((c) => c.data_nascimento && parseDataLocal(c.data_nascimento))
              .filter(Boolean)
              .map(chaveMesDia)
          )}
          agendados={new Set(ativos.map((a) => a.data))}
          selecionada={selecionada}
          onSelecionar={setSelecionada}
        />
        <ListaDoDia
          titulo={tituloDia}
          aniversariantes={aniversariantesSelecionada}
          agendados={agendadosSelecionada}
          onParabens={enviarParabens}
          onReagendar={setReagendar}
        />
      </div>

      <ReagendarDialog
        open={!!reagendar}
        agendamento={reagendar}
        onClose={() => setReagendar(null)}
        onSaved={carregar}
      />

      <Card className="p-5 mb-6">
        <Label className="text-sm font-medium">Mensagem de parabéns</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Use <span className="font-mono">{"{nome}"}</span> para o primeiro nome do cliente. A mensagem fica salva para os próximos envios.
        </p>
        <Textarea
          rows={3}
          value={msgAniv}
          onChange={(e) => { setMsgAniv(e.target.value); localStorage.setItem(CHAVE_ANIV, e.target.value); }}
        />
        <p className="text-xs text-muted-foreground mt-2">Prévia: {msgAniv.replace(/\{nome\}/g, "Maria")}</p>
      </Card>

      <Card className="p-5 mb-6">
        <Label className="text-sm font-medium">Mensagem de lembrete (véspera da avaliação)</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Use <span className="font-mono">{"{nome}"}</span> e <span className="font-mono">{"{hora}"}</span>. Enviada um dia antes, para confirmação do atendimento.
        </p>
        <Textarea
          rows={3}
          value={msgLemb}
          onChange={(e) => { setMsgLemb(e.target.value); localStorage.setItem(CHAVE_LEMB, e.target.value); }}
        />
        <p className="text-xs text-muted-foreground mt-2">Prévia: {msgLemb.replace(/\{nome\}/g, "Maria").replace(/\{hora\}/g, "09:00")}</p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
      <>
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <BellRing className="w-4 h-4 text-primary" />Amanhã · lembrete de confirmação
      </h2>
      {agendadosAmanha.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm text-muted-foreground">Nenhuma avaliação agendada para amanhã.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {agendadosAmanha.map((a) => (
            <Card key={a.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  <p className="font-medium">{nomeDe(a)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Avaliação agendada{a.hora ? ` · ${a.hora}` : ""}</p>
              </div>
              <Button onClick={() => enviarLembrete(a)}>
                <MessageCircle className="w-4 h-4 mr-2" />Enviar lembrete
              </Button>
            </Card>
          ))}
        </div>
      )}

      </>
      )}
    </AppShell>
  );
}