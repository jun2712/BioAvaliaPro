import React, { useEffect, useState } from "react";
import { db } from "@/api/dataClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageCircle, ClipboardList } from "lucide-react";
import PerguntasPicker from "./PerguntasPicker";
import WhatsAppInput from "@/components/WhatsAppInput";
import { PERGUNTAS_ANAMNESE } from "@/lib/anamneseBank";
import { CODIGOS_META_PROTEICA } from "@/lib/proteina";
import { calcularIdade } from "@/lib/bioRefs";
import { dataHojeLocal } from "@/lib/datas";

const gerarToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const vazio = () => ({
  modoProspecto: false,
  clienteId: "",
  nome: "",
  whatsapp: "",
  selecionadas: new Set(),
  erro: "",
});

// Dados que já existem na ficha do cliente e podem ir pré-preenchidos (e editáveis)
const prefillDoCliente = async (cliente) => {
  const idade = calcularIdade(cliente.data_nascimento);
  const pagina = await db.entities.Avaliacao
    .filter({ cliente_id: cliente.id }, "-data", 1)
    .catch(() => ({ items: [] }));
  const peso = pagina.items?.[0]?.peso ?? null;
  return {
    [CODIGOS_META_PROTEICA.sexo]: cliente.sexo || null,
    [CODIGOS_META_PROTEICA.idade]: idade ? String(idade) : null,
    [CODIGOS_META_PROTEICA.peso]: peso != null ? String(peso) : null,
    [CODIGOS_META_PROTEICA.altura]: cliente.altura != null ? String(cliente.altura) : null,
  };
};

// Monta a anamnese (destinatário + perguntas) e envia o link público por WhatsApp.
export default function AnamneseBuilder({ open, onClose, onSaved, clientes, conjuntos = [] }) {
  const [state, setState] = useState(vazio());
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) setState(vazio());
  }, [open]);

  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const toggle = (codigo, on) =>
    setState((s) => {
      const n = new Set(s.selecionadas);
      if (on) n.add(codigo); else n.delete(codigo);
      return { ...s, selecionadas: n };
    });

  const enviar = async () => {
    const { modoProspecto, clienteId, nome, whatsapp, selecionadas } = state;
    const cli = modoProspecto ? null : clientes.find((c) => c.id === clienteId);
    const nomeDestino = modoProspecto ? nome.trim() : cli?.nome;
    const fone = modoProspecto ? whatsapp.trim() : cli?.whatsapp;

    if (!modoProspecto && !cli) return set("erro", "Selecione um cliente da lista.");
    if (modoProspecto && !nomeDestino) return set("erro", "Informe o nome do prospecto.");
    if (modoProspecto && !fone) return set("erro", "Informe o WhatsApp do prospecto.");
    if (!selecionadas.size) return set("erro", "Selecione ao menos uma pergunta (use os filtros por categoria).");

    setEnviando(true);
    // Abre a janela de forma síncrona: o navegador bloqueia popups abertos após um await
    const win = window.open("", "_blank");
    try {
      const prefill = cli ? await prefillDoCliente(cli) : {};
      const perguntas = PERGUNTAS_ANAMNESE
        .filter((p) => selecionadas.has(p.codigo))
        .map((p) => ({
          codigo: p.codigo,
          categoria: p.categoria,
          pergunta: p.pergunta,
          tipo: p.tipo,
          opcoes: p.opcoes,
          resposta: prefill[p.codigo] || null,
        }));

      const token = gerarToken();
      await db.entities.Anamnese.create({
        cliente_id: modoProspecto ? null : cli.id,
        nome: nomeDestino,
        whatsapp: fone || null,
        data: dataHojeLocal(),
        token,
        status: "pendente",
        perguntas,
      });
      const link = `${window.location.origin}/responder/${token}`;
      const msg = encodeURIComponent(`Olá, ${nomeDestino.split(" ")[0]}! Para conhecer melhor seus hábitos e objetivos, responda sua anamnese pelo link: ${link}`);
      const foneDigits = (fone || "").replace(/\D/g, "");
      const url = foneDigits
        ? `https://api.whatsapp.com/send?phone=${foneDigits}&text=${msg}`
        : `https://api.whatsapp.com/send?text=${msg}`;
      if (win) win.location.replace(url);
      else window.location.href = url;
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (win) win.close();
      throw err;
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />Nova anamnese
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Destinatário</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Novo prospecto (sem cadastro)
                <Switch checked={state.modoProspecto} onCheckedChange={(v) => set("modoProspecto", v)} />
              </label>
            </div>
            {state.modoProspecto ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome do prospecto *</Label>
                  <Input value={state.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp *</Label>
                  <WhatsAppInput value={state.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="(11) 99999-9999" />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={state.clienteId} onValueChange={(v) => set("clienteId", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Perguntas ({state.selecionadas.size} selecionada(s))</Label>
              <p className="text-xs text-muted-foreground">Toque em "Meta Proteica" para incluir o questionário que calcula a meta de proteína.</p>
            </div>
            <PerguntasPicker
              selecionadas={state.selecionadas}
              onToggle={toggle}
              onLimpar={() => set("selecionadas", new Set())}
              conjuntos={conjuntos}
            />
          </div>
        </div>
        {state.erro && <p className="text-sm text-destructive">{state.erro}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Gerar link e enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}