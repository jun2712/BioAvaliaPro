import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2, CheckCircle2 } from "lucide-react";
import ProteinaResultado from "@/components/proteina/ProteinaResultado";

// Formulário público de anamnese: o prospecto responde pelo link, sem login.
export default function AnamnesePublica() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let ativo = true;
    base44.functions
      .invoke("anamnesePublic", { token })
      .then((res) => {
        if (!ativo) return;
        setDados(res.data);
        // Respostas já preenchidas pelo profissional (sexo, idade, peso e altura)
        const preenchidas = {};
        (res.data?.perguntas || []).forEach((p) => {
          if (p.resposta) preenchidas[p.codigo] = p.resposta;
        });
        setRespostas(preenchidas);
      })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [token]);

  const setResposta = (codigo, valor) =>
    setRespostas((r) => ({ ...r, [codigo]: valor }));

  const total = dados?.perguntas?.length || 0;
  const respondidas = Object.values(respostas).filter((v) => v && String(v).trim()).length;

  const submit = async (e) => {
    e.preventDefault();
    if (respondidas === 0) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke("anamnesePublic", { token, acao: "responder", respostas });
      setResultado(res.data?.meta_proteica || null);
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  };

  if (erro) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
        <Card className="max-w-md p-10 text-center">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Anamnese indisponível</p>
          <p className="text-sm text-muted-foreground mt-1">O link é inválido ou a anamnese não está mais disponível. Fale com o seu profissional.</p>
        </Card>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-muted/30 flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Anamnese enviada</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-12">
          <Card className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 mb-3" />
            <p className="font-medium text-lg">Obrigado{dados.nome ? `, ${dados.nome.split(" ")[0]}` : ""}!</p>
            <p className="text-sm text-muted-foreground mt-1">Suas respostas foram registradas.</p>
          </Card>
          {resultado && (
            <>
              <ProteinaResultado resultado={resultado} />
              <p className="text-xs text-center text-muted-foreground">
                A sua meta proteica foi salva no seu cadastro para o seu profissional acompanhar.
              </p>
            </>
          )}
        </main>
      </div>
    );
  }

  // Agrupa as perguntas por categoria, preservando a ordem original.
  const grupos = [];
  (dados.perguntas || []).forEach((p) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.categoria === p.categoria) ultimo.perguntas.push(p);
    else grupos.push({ categoria: p.categoria, perguntas: [p] });
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Anamnese — Autoavaliação</h1>
          <p className="text-sm text-muted-foreground">
            {dados.nome ? `Olá, ${dados.nome}! ` : ""}Responda as perguntas para o seu profissional.
          </p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={submit} className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {respondidas} de {total} pergunta(s) respondida(s). Não é preciso responder todas.
          </p>
          {grupos.map((g) => (
            <Card key={g.categoria} className="p-5">
              <h2 className="font-semibold mb-4">{g.categoria}</h2>
              <div className="space-y-5">
                {g.perguntas.map((p) => (
                  <div key={p.codigo} className="space-y-1.5">
                    <Label>{p.pergunta}</Label>
                    {p.tipo === "select" && (p.opcoes || []).length > 0 ? (
                      <Select value={respostas[p.codigo] || ""} onValueChange={(v) => setResposta(p.codigo, v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione a resposta" /></SelectTrigger>
                        <SelectContent>
                          {p.opcoes.map((op) => (
                            <SelectItem key={op} value={op}>{op}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : p.tipo === "number" ? (
                      <Input
                        inputMode="decimal"
                        value={respostas[p.codigo] || ""}
                        onChange={(e) => setResposta(p.codigo, e.target.value)}
                        placeholder="Digite o valor"
                        className="h-11"
                      />
                    ) : (
                      <Textarea
                        rows={2}
                        value={respostas[p.codigo] || ""}
                        onChange={(e) => setResposta(p.codigo, e.target.value)}
                        placeholder="Digite a sua resposta"
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <div className="pb-6">
            <Button type="submit" size="lg" className="w-full" disabled={enviando || respondidas === 0}>
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enviar anamnese
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}