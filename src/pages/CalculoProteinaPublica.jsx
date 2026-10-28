import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Loader2, Beef } from "lucide-react";
import ProteinaForm from "@/components/proteina/ProteinaForm";
import ProteinaResultado from "@/components/proteina/ProteinaResultado";

// Formulário público de meta proteica: o cliente responde pelo link do WhatsApp, sem login.
export default function CalculoProteinaPublica() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let ativo = true;
    base44.functions
      .invoke("proteinaPublic", { token })
      .then((res) => { if (ativo) setDados(res.data); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [token]);

  const enviar = async (respostas) => {
    setEnviando(true);
    try {
      const res = await base44.functions.invoke("proteinaPublic", { token, acao: "responder", respostas });
      setResultado(res.data.resultado);
    } finally {
      setEnviando(false);
    }
  };

  if (erro) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
        <Card className="max-w-md p-10 text-center">
          <Beef className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Link indisponível</p>
          <p className="text-sm text-muted-foreground mt-1">
            Este link é inválido ou não está mais ativo. Fale com o seu profissional.
          </p>
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

  const respondido = resultado || dados.resultado;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">BioAvalia App</p>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight mt-0.5">Calculadora de meta proteica</h1>
          <p className="text-sm text-muted-foreground">
            {dados.nome ? `Olá, ${dados.nome.split(" ")[0]}! ` : ""}Responda as perguntas para saber quanto de
            proteína consumir por dia.
          </p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-12">
        {respondido && <ProteinaResultado resultado={respondido} />}
        <Card className="p-5 sm:p-6">
          <ProteinaForm inicial={dados.status === "respondida" ? dados : null} enviando={enviando} onSubmit={enviar} />
        </Card>
        {respondido && (
          <p className="text-xs text-center text-muted-foreground">
            Você pode refazer o cálculo sempre que quiser — o resultado novo substitui o anterior.
          </p>
        )}
      </main>
    </div>
  );
}