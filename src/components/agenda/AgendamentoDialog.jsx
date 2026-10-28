import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { dataHojeLocal } from "@/lib/datas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_AGENDAMENTO } from "@/lib/fluxo";
import { conflitosNoHorario, horariosLivres } from "@/lib/conflitos";
import ConflitoHorario from "@/components/agenda/ConflitoHorario";

const rotuloTipo = (v) => TIPOS_AGENDAMENTO.find((t) => t.value === v)?.label || v;

// Agendamento de avaliação: registra data e hora no app e cria o evento
// no Google Calendar conectado (título "Nome / Avaliação Agendada").
// Se o Google não confirmar o evento, o aviso fica visível e o evento pode ser reenviado.
export default function AgendamentoDialog({ open, onClose, cliente }) {
  const [data, setData] = useState(dataHojeLocal());
  const [hora, setHora] = useState("09:00");
  const [tipo, setTipo] = useState("avaliacao");
  const [saving, setSaving] = useState(false);
  const [aviso, setAviso] = useState("");
  const [dia, setDia] = useState([]);
  const [nomes, setNomes] = useState({});
  const [conflitos, setConflitos] = useState([]);
  const [livres, setLivres] = useState([]);
  const [salvo, setSalvo] = useState(null);

  useEffect(() => {
    if (open) {
      setData(dataHojeLocal());
      setHora("09:00");
      setTipo("avaliacao");
      setAviso("");
      setConflitos([]);
      setSalvo(null);
    }
  }, [open]);

  // Agenda do próprio coach no dia escolhido (base para a checagem de conflito)
  useEffect(() => {
    if (!open || !data) {
      setDia([]);
      return;
    }
    let ativo = true;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const page = await base44.entities.Agendamento.filter(
        { data, created_by_id: me?.id },
        { limit: 100 }
      ).catch(() => ({ items: [] }));
      const itens = page.items || [];
      if (!ativo) return;
      setDia(itens);
      const ids = [...new Set(itens.map((a) => a.cliente_id).filter(Boolean))];
      if (!ids.length) {
        setNomes({});
        return;
      }
      const cls = await base44.entities.Cliente.filter({ id: { $in: ids } }, { limit: 100 }).catch(
        () => ({ items: [] })
      );
      if (!ativo) return;
      setNomes(Object.fromEntries((cls.items || []).map((c) => [c.id, c.nome])));
    })();
    return () => {
      ativo = false;
    };
  }, [open, data]);

  // Envia (ou reenvia) o evento ao Google Calendar do Coach.
  // Sem evento criado, o agendamento permanece salvo no app e o erro fica na tela.
  const enviarParaGoogle = async (ag) => {
    try {
      const res = await base44.functions.invoke("criarEventoGoogle", {
        cliente_id: cliente.id,
        data: ag.data,
        hora: ag.hora,
      });
      if (res.data?.event_id) {
        await base44.entities.Agendamento.update(ag.id, {
          google_event_id: res.data.event_id,
          google_link: res.data.html_link,
        });
        setSalvo(null);
        setAviso("");
        onClose?.();
        return;
      }
      setSalvo(ag);
      setAviso(
        res.data?.vinculado === false
          ? "Agendamento salvo no app, mas nenhum evento foi criado: a agenda Google compartilhada não está conectada. Peça ao administrador para ativá-la e use “Tentar no Google”."
          : "Agendamento salvo no app, mas o evento não foi criado no Google Calendar."
      );
    } catch (err) {
      setSalvo(ag);
      setAviso(
        err?.response?.data?.error ||
          "Agendamento salvo no app, mas houve um erro ao criar o evento no Google Calendar."
      );
    }
  };

  const salvar = async () => {
    if (saving) return;
    setSaving(true);
    setAviso("");
    try {
      const ag = await base44.entities.Agendamento.create({
        cliente_id: cliente.id,
        data,
        hora,
        tipo,
        status: "agendado",
      });
      // O retorno agendado passa a ser a próxima avaliação do cliente no painel
      if (tipo === "avaliacao" || tipo === "retorno") {
        await base44.entities.Cliente.update(cliente.id, { proxima_avaliacao: data });
      }
      setConflitos([]);
      await enviarParaGoogle(ag);
    } finally {
      setSaving(false);
    }
  };

  const retentar = async () => {
    if (!salvo || saving) return;
    setSaving(true);
    setAviso("");
    try {
      await enviarParaGoogle(salvo);
    } finally {
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (saving || salvo) return;
    const achados = conflitosNoHorario(dia, data, hora);
    if (achados.length) {
      setConflitos(
        achados.map((a) => ({
          ...a,
          nome: nomes[a.cliente_id] || (a.cliente_id === cliente?.id ? cliente?.nome : ""),
          tipoLabel: rotuloTipo(a.tipo),
        }))
      );
      setLivres(horariosLivres(dia, data));
      return;
    }
    salvar();
  };

  const escolher = (h) => {
    setConflitos([]);
    if (h) setHora(h);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agendar avaliação</DialogTitle>
          <DialogDescription>
            {cliente?.nome} · o evento será criado no Google Calendar com duração de 1 hora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de atendimento</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={!!salvo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_AGENDAMENTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => { setData(e.target.value); setConflitos([]); }}
                disabled={!!salvo}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={hora}
                onChange={(e) => { setHora(e.target.value); setConflitos([]); }}
                disabled={!!salvo}
                required
              />
            </div>
          </div>

          {conflitos.length > 0 && (
            <ConflitoHorario
              conflitos={conflitos}
              livres={livres}
              onEscolher={escolher}
              onConfirmar={salvar}
              saving={saving}
            />
          )}

          {aviso && (
            <p className="text-sm text-destructive flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{aviso}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>{salvo ? "Fechar" : "Cancelar"}</Button>
            {salvo ? (
              <Button type="button" onClick={retentar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Tentar no Google
              </Button>
            ) : conflitos.length === 0 ? (
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Agendar
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}