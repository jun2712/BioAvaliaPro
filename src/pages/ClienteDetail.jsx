import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/AppShell";
import ClienteForm from "@/components/ClienteForm";
import ReportContent from "@/components/ReportContent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { calcularIdade } from "@/lib/bioRefs";
import { formatarDataBR } from "@/lib/datas";
import { linkWhatsApp } from "@/lib/whatsapp";
import { Plus, Pencil, Phone, Mail, Cake, ArrowLeft, Loader2, Activity, MessageCircle, Trash2, User, CalendarPlus, StickyNote, Save } from "lucide-react";
import ConfirmButton from "@/components/ConfirmButton";
import AgendamentoDialog from "@/components/agenda/AgendamentoDialog";
import StatusBadge from "@/components/cliente/StatusBadge";
import ProteinaCard from "@/components/cliente/ProteinaCard";

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [agendOpen, setAgendOpen] = useState(false);
  const [notaEdit, setNotaEdit] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [mostrarNavy, setMostrarNavy] = useState(true);

  // Visibilidade das medidas U.S. Navy definida em Configurações
  useEffect(() => {
    base44.auth.me().then((u) => setMostrarNavy(u?.mostrar_navy !== false)).catch(() => {});
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const c = await base44.entities.Cliente.get(id);
      setCliente(c);
      setNotaEdit(c.notas || "");
      const avs = await base44.entities.Avaliacao.filter({ cliente_id: id }, "data", 200);
      setAvaliacoes(avs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [id]);

  if (loading) {
    return <AppShell title="Cliente"><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }

  if (!cliente) {
    return <AppShell title="Cliente"><p className="text-muted-foreground">Cliente não encontrado.</p></AppShell>;
  }

  const idade = calcularIdade(cliente.data_nascimento);
  const ultima = avaliacoes[avaliacoes.length - 1];

  const excluirAvaliacao = async (a) => {
    await base44.entities.Avaliacao.delete(a.id);
    carregar();
  };

  const excluirCliente = async () => {
    await base44.entities.Avaliacao.deleteMany({ cliente_id: cliente.id });
    await base44.entities.Cliente.delete(cliente.id);
    navigate("/clientes");
  };

  const compartilharWhatsApp = async () => {
    if (compartilhando) return;
    setCompartilhando(true);
    // Abre a janela de forma síncrona: o navegador bloqueia popups abertos após um await
    const win = window.open("", "_blank");
    try {
      let token = cliente.share_token;
      if (!token) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        await base44.entities.Cliente.update(cliente.id, { share_token: token });
        setCliente((c) => ({ ...c, share_token: token }));
      }
      const link = `${window.location.origin}/relatorio/${token}`;
      const msg = encodeURIComponent(`Olá, ${cliente.nome.split(" ")[0]}! Segue o link do seu relatório de avaliações físicas: ${link}`);
      const url = linkWhatsApp(cliente.whatsapp, msg);
      if (win) win.location.replace(url);
      else window.location.href = url;
    } catch (err) {
      if (win) win.close();
      throw err;
    } finally {
      setCompartilhando(false);
    }
  };

  return (
    <AppShell
      title={cliente.nome}
      subtitle={`${cliente.codigo ? cliente.codigo + " · " : ""}${idade ? idade + " anos · " : ""}${cliente.sexo || ""}${cliente.altura ? " · " + cliente.altura + " cm" : ""}`}
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate("/clientes")} title="Voltar"><ArrowLeft className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Clientes</span></Button>
          <Button variant="outline" onClick={() => setEditOpen(true)} title="Editar cliente"><Pencil className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Editar</span></Button>
          <Button
            variant="outline"
            onClick={compartilharWhatsApp}
            disabled={!ultima || compartilhando}
            title="Envia o link do relatório pelo WhatsApp — o cliente abre sem precisar se cadastrar"
          >
            {compartilhando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            <span className="hidden sm:inline">{compartilhando ? "Gerando link..." : "WhatsApp"}</span>
          </Button>
          <Button variant="outline" onClick={() => setAgendOpen(true)} title="Agendar avaliação"><CalendarPlus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Agendar avaliação</span></Button>
          <Button onClick={() => navigate(`/avaliacao/nova/${cliente.id}`)} title="Nova avaliação"><Plus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Nova avaliação</span></Button>
          <ConfirmButton
            trigger={
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" title="Excluir cliente">
                <Trash2 className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Excluir</span>
              </Button>
            }
            title="Excluir cliente"
            description={`${cliente.nome} e todas as suas avaliações serão removidos permanentemente. Esta ação não pode ser desfeita.`}
            confirmLabel="Excluir cliente"
            onConfirm={excluirCliente}
          />
        </>
      }
    >
      {/* Situação do acompanhamento */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <StatusBadge status={cliente.status} />
        {cliente.objetivo && (
          <span className="text-sm text-muted-foreground">Objetivo: <span className="text-foreground">{cliente.objetivo}</span></span>
        )}
        {cliente.proxima_avaliacao && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarPlus className="w-4 h-4" />Próxima avaliação: {formatarDataBR(cliente.proxima_avaliacao)}
          </span>
        )}
        {cliente.data_inicio && (
          <span className="text-sm text-muted-foreground">Acompanhamento desde {formatarDataBR(cliente.data_inicio)}</span>
        )}
      </div>

      {/* Contato */}
      {(cliente.whatsapp || cliente.email || cliente.data_nascimento) && (
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
          {cliente.whatsapp && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{cliente.whatsapp}</span>}
          {cliente.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{cliente.email}</span>}
          {cliente.data_nascimento && <span className="flex items-center gap-1.5"><Cake className="w-4 h-4" />Nascimento: {formatarDataBR(cliente.data_nascimento)}</span>}
          {cliente.coach && <span className="flex items-center gap-1.5"><User className="w-4 h-4" />Coach: {cliente.coach}</span>}
        </div>
      )}

      {/* Notas do cliente: editáveis no perfil */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Notas do cliente</h3>
        </div>
        <Textarea
          rows={3}
          value={notaEdit}
          onChange={(e) => setNotaEdit(e.target.value)}
          placeholder="Observações sobre o cliente..."
        />
        <div className="flex items-center gap-3 mt-3">
          <Button
            size="sm"
            disabled={salvandoNota || notaEdit === (cliente.notas || "")}
            onClick={async () => {
              setSalvandoNota(true);
              try {
                await base44.entities.Cliente.update(cliente.id, { notas: notaEdit.trim() || null });
                setCliente((c) => ({ ...c, notas: notaEdit.trim() || null }));
              } finally {
                setSalvandoNota(false);
              }
            }}
          >
            {salvandoNota ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar notas
          </Button>
        </div>
      </Card>

      <ProteinaCard cliente={cliente} />

      {!ultima ? (
        <Card className="p-12 text-center border-dashed">
          <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhuma avaliação registrada</p>
          <p className="text-sm text-muted-foreground mt-1">Registre a primeira avaliação deste cliente.</p>
          <Button className="mt-4" onClick={() => navigate(`/avaliacao/nova/${cliente.id}`)}><Plus className="w-4 h-4 mr-2" />Nova avaliação</Button>
        </Card>
      ) : (
        <ReportContent
          cliente={cliente}
          avaliacoes={avaliacoes}
          mostrarNotasPrivadas
          mostrarNavy={mostrarNavy}
          metaProteica={cliente.meta_proteica}
          onEditarUltima={() => navigate(`/avaliacao/editar/${ultima.id}`)}
          onAbrirAvaliacao={(a) => navigate(`/avaliacao/editar/${a.id}`)}
          onExcluirAvaliacao={excluirAvaliacao}
        />
      )}

      <ClienteForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={carregar} cliente={cliente} />
      <AgendamentoDialog open={agendOpen} onClose={() => setAgendOpen(false)} cliente={cliente} />
    </AppShell>
  );
}