import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Layers } from "lucide-react";
import PerguntasPicker from "./PerguntasPicker";
import ConfirmButton from "@/components/ConfirmButton";

const novoVazio = () => ({ id: null, nome: "", codigos: new Set() });

// Criação e edição dos conjuntos personalizados de perguntas da anamnese.
export default function ConjuntosManager({ open, onClose, onSaved }) {
  const [conjuntos, setConjuntos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      setConjuntos(await base44.entities.ConjuntoAnamnese.list("-created_date", 100));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setEditando(null);
      setErro("");
      carregar();
    }
  }, [open]);

  const toggle = (codigo, on) => setEditando((e) => {
    const n = new Set(e.codigos);
    if (on) n.add(codigo); else n.delete(codigo);
    return { ...e, codigos: n };
  });

  const salvar = async () => {
    const { id, nome, codigos } = editando;
    if (!nome.trim()) { setErro("Informe um nome para o conjunto."); return; }
    if (!codigos.size) { setErro("Selecione ao menos uma pergunta."); return; }
    setSalvando(true);
    try {
      const payload = { nome: nome.trim(), codigos: [...codigos] };
      if (id) await base44.entities.ConjuntoAnamnese.update(id, payload);
      else await base44.entities.ConjuntoAnamnese.create(payload);
      setEditando(null);
      setErro("");
      await carregar();
      onSaved?.();
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (c) => {
    await base44.entities.ConjuntoAnamnese.delete(c.id);
    await carregar();
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="w-4 h-4" />Meus conjuntos de perguntas</DialogTitle>
        </DialogHeader>

        {editando ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do conjunto *</Label>
              <Input
                value={editando.nome}
                onChange={(e) => setEditando((s) => ({ ...s, nome: e.target.value }))}
                placeholder="Ex.: Anamnese completa, Primeira consulta..."
              />
            </div>
            <PerguntasPicker
              selecionadas={editando.codigos}
              onToggle={toggle}
              onLimpar={() => setEditando((s) => ({ ...s, codigos: new Set() }))}
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setEditando(null); setErro(""); }}>Voltar</Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar conjunto
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : conjuntos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum conjunto criado ainda. Crie um conjunto com as perguntas que você mais usa para selecioná-las de uma vez ao montar uma anamnese.
              </p>
            ) : (
              conjuntos.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{(c.codigos || []).length} pergunta(s)</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" title="Editar conjunto"
                      onClick={() => setEditando({ id: c.id, nome: c.nome, codigos: new Set(c.codigos || []) })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <ConfirmButton
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Excluir conjunto">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      }
                      title="Excluir conjunto"
                      description={`O conjunto "${c.nome}" será removido. As anamneses já enviadas não são afetadas.`}
                      confirmLabel="Excluir"
                      onConfirm={() => excluir(c)}
                    />
                  </div>
                </div>
              ))
            )}
            <Button onClick={() => setEditando(novoVazio())}>
              <Plus className="w-4 h-4 mr-2" />Novo conjunto
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}