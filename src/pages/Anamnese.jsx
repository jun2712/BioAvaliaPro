import React, { useEffect, useState } from "react";
import { db } from "@/api/dataClient";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardList, MessageCircle, Eye, Trash2, Plus, Layers, Search } from "lucide-react";
import AnamneseBuilder from "@/components/anamnese/AnamneseBuilder";
import RespostasView from "@/components/anamnese/RespostasView";
import ConfirmButton from "@/components/ConfirmButton";
import ConjuntosManager from "@/components/anamnese/ConjuntosManager";
import RespostasCsv from "@/components/anamnese/RespostasCsv";
import { linkWhatsApp } from "@/lib/whatsapp";

export default function Anamnese() {
  const [anamneses, setAnamneses] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [conjuntos, setConjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [conjuntosOpen, setConjuntosOpen] = useState(false);
  const [vista, setVista] = useState(null);
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      const [lista, cls, cjs] = await Promise.all([
        db.entities.Anamnese.list("-created_date", 200),
        db.entities.Cliente.list("-updated_date", 500),
        db.entities.ConjuntoAnamnese.list("-created_date", 100),
      ]);
      setAnamneses(lista);
      setClientes(cls);
      setConjuntos(cjs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // Busca de anamneses por nome do cliente (ou prospecto) ou WhatsApp
  const termo = busca.trim().toLowerCase();
  const listaFiltrada = anamneses.filter((a) =>
    !termo ||
    (a.nome || "").toLowerCase().includes(termo) ||
    (a.whatsapp || "").includes(termo)
  );

  const reenviar = (a) => {
    const link = `${window.location.origin}/responder/${a.token}`;
    const primeiroNome = a.nome ? a.nome.split(" ")[0] : "";
    const msg = encodeURIComponent(`Olá${primeiroNome ? ", " + primeiroNome : ""}! Para registrar sua anamnese, responda pelo link: ${link}`);
    const url = linkWhatsApp(a.whatsapp, msg);
    window.open(url, "_blank");
  };

  const excluir = async (a) => {
    await db.entities.Anamnese.delete(a.id);
    carregar();
  };

  return (
    <AppShell
      title="Anamnese"
      subtitle="Questionários de autoavaliação enviados por WhatsApp"
      actions={
        <>
          <Button onClick={() => setBuilderOpen(true)} title="Nova anamnese">
            <Plus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Nova anamnese</span>
          </Button>
          <RespostasCsv onImported={carregar} />
          <Button variant="outline" onClick={() => setConjuntosOpen(true)} title="Meus conjuntos">
            <Layers className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Meus conjuntos</span>
          </Button>
        </>
      }
    >
      <div className="relative max-w-sm flex-1 mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou WhatsApp..." className="pl-9 h-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : listaFiltrada.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          {termo ? (
            <>
              <p className="font-medium">Nenhuma anamnese encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">Tente outro termo de busca.</p>
            </>
          ) : (
            <>
              <p className="font-medium">Nenhuma anamnese enviada</p>
              <p className="text-sm text-muted-foreground mt-1">Monte um questionário com as perguntas do modelo FineShape e envie por WhatsApp.</p>
              <Button className="mt-4" onClick={() => setBuilderOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova anamnese</Button>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {listaFiltrada.map((a) => (
            <Card key={a.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{a.nome || "Prospecto"}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    a.status === "respondida"
                      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                      : "text-amber-600 bg-amber-50 border-amber-200"
                  }`}>
                    {a.status === "respondida" ? "Respondida" : "Pendente"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(a.perguntas || []).length} pergunta(s)
                  {a.whatsapp ? ` · ${a.whatsapp}` : ""}
                  {a.status === "respondida" && a.respondida_em
                    ? ` · respondida em ${new Date(a.respondida_em).toLocaleDateString("pt-BR")}`
                    : ` · criada em ${new Date(a.created_date).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => reenviar(a)} title="Enviar o link novamente por WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                </Button>
                {a.status === "respondida" && (
                  <Button variant="ghost" size="sm" onClick={() => setVista(a)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" />Respostas
                  </Button>
                )}
                <ConfirmButton
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Excluir anamnese">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  }
                  title="Excluir anamnese"
                  description={`A anamnese de ${a.nome || "prospecto"} e suas respostas serão removidas permanentemente. Esta ação não pode ser desfeita.`}
                  confirmLabel="Excluir"
                  onConfirm={() => excluir(a)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnamneseBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={carregar}
        clientes={clientes}
        conjuntos={conjuntos}
      />
      <ConjuntosManager open={conjuntosOpen} onClose={() => setConjuntosOpen(false)} onSaved={carregar} />
      <RespostasView anamnese={vista} open={!!vista} onClose={() => setVista(null)} />
    </AppShell>
  );
}