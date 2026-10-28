import React, { useState } from "react";
import { db } from "@/api/dataClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmButton from "@/components/ConfirmButton";
import { nomeCoachEmUso, normalizarNomeCoach } from "@/lib/coach";
import { ShieldCheck, UserRound, Trash2, Pencil, ChevronRight } from "lucide-react";

const PERMISSOES = {
  admin: "Coach com permissão de Administrador: além dos próprios dados, vê e gerencia clientes, avaliações e anamneses de todos os coaches, e administra usuários.",
  coach: "Coach: vê e gerencia apenas os próprios clientes, avaliações e anamneses.",
};

// Lista unificada de usuários e coaches: todo usuário é Coach (com seus clientes
// e avaliações) e pode receber a permissão extra de Administrador.
export default function UsuariosTable({ usuarios, clientes, avaliacoes, coachesSemConta = [], meuId, onAtualizar, onVerClientes }) {
  const [editando, setEditando] = useState(null);
  const [nomeCoach, setNomeCoach] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);

  const nome = (u) => u.coach_nome || u.full_name || u.email;

  // Volume por usuário: registros criados por ele OU vinculados ao seu nome de Coach.
  const volume = (u) => {
    const alvo = (u.coach_nome || "").trim().toLowerCase();
    const coincide = (r) =>
      r.created_by_id === u.id || (!!alvo && (r.coach || "").trim().toLowerCase() === alvo);
    const cl = clientes.filter(coincide);
    const av = avaliacoes.filter(coincide);
    const datas = [...cl, ...av].map((r) => r.updated_date).filter(Boolean).sort();
    return {
      clientes: cl.length,
      avaliacoes: av.length,
      ultima: datas.length ? datas[datas.length - 1] : null,
    };
  };

  const abrirEdicao = (u) => {
    setEditando(u);
    setNomeCoach(u.coach_nome || "");
    setErroNome("");
  };

  const salvarNomeCoach = async () => {
    const limpo = nomeCoach.trim();
    if (!limpo || salvandoNome) return;
    setErroNome("");
    if (await nomeCoachEmUso(limpo, editando.id)) {
      setErroNome("Este nome de Coach já está em uso por outro profissional. Escolha um nome diferente.");
      return;
    }
    setSalvandoNome(true);
    try {
      const anterior = (editando.coach_nome || "").trim();
      await db.entities.User.update(editando.id, { coach_nome: limpo });
      // Propaga o nome para os registros do próprio usuário e para os que
      // usavam o nome de Coach anterior (ex.: registros importados)
      const ops = [
        db.entities.Cliente.updateMany({ created_by_id: editando.id }, { $set: { coach: limpo } }),
        db.entities.Avaliacao.updateMany({ created_by_id: editando.id }, { $set: { coach: limpo } }),
      ];
      if (anterior && normalizarNomeCoach(anterior) !== normalizarNomeCoach(limpo)) {
        ops.push(
          db.entities.Cliente.updateMany({ coach: anterior }, { $set: { coach: limpo } }),
          db.entities.Avaliacao.updateMany({ coach: anterior }, { $set: { coach: limpo } }),
        );
      }
      await Promise.all(ops).catch(() => {});
      setEditando(null);
      onAtualizar();
    } finally {
      setSalvandoNome(false);
    }
  };

  const alterarPapel = async (u) => {
    await db.entities.User.update(u.id, { role: u.role === "admin" ? "user" : "admin" });
    onAtualizar();
  };

  const remover = async (u) => {
    await db.entities.User.delete(u.id);
    onAtualizar();
  };

  return (
    <div className="space-y-3">
      {usuarios.map((u) => {
        const admin = u.role === "admin";
        const v = volume(u);
        return (
          <Card key={u.id} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {admin
                    ? <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    : <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <p className="font-medium truncate">{nome(u)}</p>
                  <Badge variant="secondary">Coach</Badge>
                  {admin && <Badge>Administrador</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{u.email}</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">
                  {PERMISSOES[admin ? "admin" : "coach"]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {v.clientes} cliente(s) · {v.avaliacoes} avaliação(ões)
                  {v.ultima ? ` · última atividade em ${new Date(v.ultima).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <Button variant="outline" size="sm" onClick={() => onVerClientes && onVerClientes(nome(u))}>
                  Ver clientes<ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => abrirEdicao(u)} title="Editar nome de Coach">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {u.id !== meuId && (
                  <>
                    <ConfirmButton
                      trigger={
                        <Button variant="outline" size="sm">
                          {admin ? "Remover admin" : "Tornar admin"}
                        </Button>
                      }
                      title="Alterar permissão"
                      description={admin
                        ? `${nome(u)} continuará como Coach, mas perderá o acesso aos dados dos demais coaches e à administração.`
                        : `${nome(u)} passará a ser Coach com permissão de Administrador, com acesso aos dados de todos os coaches.`}
                      confirmLabel="Confirmar"
                      onConfirm={() => alterarPapel(u)}
                    />
                    <ConfirmButton
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Remover usuário">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      }
                      title="Remover usuário"
                      description={`${nome(u)} perderá o acesso ao app imediatamente e esta ação não pode ser desfeita. Os clientes e avaliações que ele criou permanecem cadastrados e visíveis para os administradores.`}
                      confirmLabel="Remover"
                      onConfirm={() => remover(u)}
                    />
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {coachesSemConta.length > 0 && (
        <Card className="p-4 border-dashed">
          <div className="flex items-center gap-2 mb-1">
            <UserRound className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium">Coaches nos registros (sem conta no app)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3 max-w-2xl">
            Nomes vinculados a clientes e avaliações (inclusive registros importados) que ainda não correspondem a
            nenhum usuário. Ao definir um destes nomes como "Nome de Coach" de um usuário, os registros passam a
            aparecer na lista acima.
          </p>
          <div className="flex flex-wrap gap-2">
            {coachesSemConta.map((n) => (
              <Badge key={n} variant="secondary">{n}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome de Coach</DialogTitle>
            <DialogDescription>
              Nome que identifica os clientes e avaliações de {editando ? nome(editando) : ""}.
              Os registros existentes criados por este usuário passam a usar o nome atualizado.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={nomeCoach}
            onChange={(e) => setNomeCoach(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvarNomeCoach()}
            placeholder="Ex: Jun Takakura"
          />
          {erroNome && <p className="text-sm text-destructive">{erroNome}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvarNomeCoach} disabled={salvandoNome || !nomeCoach.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}