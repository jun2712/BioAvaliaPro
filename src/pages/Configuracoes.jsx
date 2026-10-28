import React, { useEffect, useState } from "react";
import { db } from "@/api/dataClient";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Loader2, Save, Ruler, User, FileText, ShieldCheck } from "lucide-react";
import { MEDIDAS_PERIOMETRIA } from "@/lib/medidas";
import useMedidasAtivas from "@/hooks/useMedidasAtivas";
import { nomeCoachEmUso, normalizarNomeCoach } from "@/lib/coach";

export default function Configuracoes() {
  const medidas = useMedidasAtivas();
  const [selecionadas, setSelecionadas] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [mostrarNavy, setMostrarNavy] = useState(true);
  const [coachNome, setCoachNome] = useState(null);
  const [coachNomeOriginal, setCoachNomeOriginal] = useState("");
  const [erroCoach, setErroCoach] = useState("");
  const [salvandoCoach, setSalvandoCoach] = useState(false);
  const [salvoCoach, setSalvoCoach] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    db.auth.me().then((u) => {
      setCoachNome(u?.coach_nome || "");
      setCoachNomeOriginal(u?.coach_nome || "");
      setUserId(u?.id || null);
      setMostrarNavy(u?.mostrar_navy !== false);
    }).catch(() => setCoachNome(""));
  }, []);

  useEffect(() => {
    if (medidas && selecionadas == null) setSelecionadas(medidas);
  }, [medidas]);

  const toggle = (name) => {
    setSalvo(false);
    setSelecionadas((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await db.auth.updateMe({ medidas_ativas: selecionadas, mostrar_navy: mostrarNavy });
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarCoach = async () => {
    const limpo = coachNome?.trim();
    if (!limpo) return;
    setErroCoach("");
    if (await nomeCoachEmUso(limpo, userId)) {
      setErroCoach("Este nome de Coach já está em uso por outro profissional. Escolha um nome diferente.");
      return;
    }
    setSalvandoCoach(true);
    try {
      const anterior = (coachNomeOriginal || "").trim();
      await db.auth.updateMe({ coach_nome: limpo });
      // Propaga o nome para os registros já existentes do coach
      if (userId) {
        const ops = [
          db.entities.Cliente.updateMany({ created_by_id: userId }, { $set: { coach: limpo } }),
          db.entities.Avaliacao.updateMany({ created_by_id: userId }, { $set: { coach: limpo } }),
        ];
        // Registros vinculados pelo nome antigo (ex.: importados) seguem o coach
        if (anterior && normalizarNomeCoach(anterior) !== normalizarNomeCoach(limpo)) {
          ops.push(
            db.entities.Cliente.updateMany({ coach: anterior }, { $set: { coach: limpo } }),
            db.entities.Avaliacao.updateMany({ coach: anterior }, { $set: { coach: limpo } }),
          );
        }
        await Promise.all(ops).catch(() => {});
        setCoachNomeOriginal(limpo);
      }
      setSalvoCoach(true);
    } finally {
      setSalvandoCoach(false);
    }
  };

  return (
    <AppShell title="Configurações" subtitle="Preferências do profissional">
      <Card className="p-5 max-w-3xl mb-6">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Nome do Coach</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Nome que identifica seus clientes e avaliações. Enquanto não definido, o sistema usa o seu e-mail de login.
        </p>
        <div className="flex gap-2 max-w-sm">
          <Input
            value={coachNome ?? ""}
            onChange={(e) => { setCoachNome(e.target.value); setSalvoCoach(false); }}
            placeholder="Ex: Coach Ana"
          />
          <Button onClick={salvarCoach} disabled={salvandoCoach || !coachNome?.trim()}>
            {salvandoCoach ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
        {salvoCoach && <p className="text-sm text-emerald-600 mt-2">Nome salvo.</p>}
        {erroCoach && <p className="text-sm text-destructive mt-2">{erroCoach}</p>}
      </Card>

      <Card className="p-5 max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <Ruler className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Medidas usadas nas avaliações</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Desmarque as medidas que você não utiliza — elas deixam de aparecer no formulário de avaliação e no relatório.
          Cintura e Quadril alimentam o cálculo da Relação Cintura-Quadril e do método U.S. Navy.
        </p>
        {selecionadas == null ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MEDIDAS_PERIOMETRIA.map((m) => (
                <label key={m.name} className="flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selecionadas.includes(m.name)} onCheckedChange={() => toggle(m.name)} />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2.5 mt-5 cursor-pointer">
              <Checkbox checked={mostrarNavy} onCheckedChange={(v) => { setMostrarNavy(v); setSalvo(false); }} />
              <span className="text-sm">Exibir a seção "Avaliação por medidas (U.S. Navy)" no relatório</span>
            </label>
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <Button onClick={salvar} disabled={salvando || selecionadas.length === 0}>
                {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => { setSelecionadas(MEDIDAS_PERIOMETRIA.map((m) => m.name)); setSalvo(false); }}>
                Marcar todas
              </Button>
              {salvo && <span className="text-sm text-emerald-600">Configurações salvas.</span>}
              {selecionadas.length === 0 && <span className="text-sm text-destructive">Selecione ao menos uma medida.</span>}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Documentos legais</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Consulte os documentos aceitos no cadastro.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to="/privacidade" target="_blank" rel="noopener noreferrer">
              <ShieldCheck className="w-4 h-4 mr-2" />Política de Privacidade
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/termos" target="_blank" rel="noopener noreferrer">
              <FileText className="w-4 h-4 mr-2" />Termos de Uso
            </Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}