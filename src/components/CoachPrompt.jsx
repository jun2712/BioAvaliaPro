import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { nomeCoachEmUso } from "@/lib/coach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADIAR = "bioavalia_coach_nome_adiar";

// Pergunta o nome de Coach no primeiro acesso (adiável; editável em Configurações).
// Enquanto não definido, o sistema usa o e-mail de login.
export default function CoachPrompt() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then((u) => {
        setUserId(u?.id || null);
        if (!u?.coach_nome && localStorage.getItem(ADIAR) !== "1") setOpen(true);
      })
      .catch(() => {});
  }, []);

  const salvar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;
    setErro("");
    if (await nomeCoachEmUso(limpo, userId)) {
      setErro("Este nome de Coach já está em uso por outro profissional. Escolha um nome diferente.");
      return;
    }
    setSalvando(true);
    try {
      await base44.auth.updateMe({ coach_nome: limpo });
      // Propaga o nome para os registros já existentes do coach
      if (userId) {
        await Promise.all([
          base44.entities.Cliente.updateMany({ created_by_id: userId }, { $set: { coach: limpo } }),
          base44.entities.Avaliacao.updateMany({ created_by_id: userId }, { $set: { coach: limpo } }),
        ]).catch(() => {});
      }
      localStorage.removeItem(ADIAR);
      setOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  const adiar = () => {
    localStorage.setItem(ADIAR, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && adiar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha seu nome de Coach</DialogTitle>
          <DialogDescription>
            É o nome que identificará seus clientes e avaliações — pode ser alterado depois nas Configurações.
            Enquanto não definir, o sistema usará o seu e-mail de login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Nome do Coach</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Ex: Coach Ana"
          />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={adiar}>Agora não</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}