import React, { useState } from "react";
import { db } from "@/api/dataClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Send } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";

// Análise da anamnese com IA: recomendação editável + encaminhamento por WhatsApp.
export default function AnaliseIA({ anamnese }) {
  const [analisando, setAnalisando] = useState(false);
  const [recomendacao, setRecomendacao] = useState("");
  const [erro, setErro] = useState("");

  const analisar = async () => {
    setAnalisando(true);
    setErro("");
    try {
      const res = await db.functions.invoke("anamneseAnalise", { anamnese_id: anamnese.id });
      setRecomendacao(res.data?.recomendacao || "");
    } catch (e) {
      setErro(e?.response?.data?.error || "Não foi possível gerar a análise. Tente novamente.");
    } finally {
      setAnalisando(false);
    }
  };

  const enviar = () => {
    const msg = encodeURIComponent(recomendacao.trim());
    window.open(linkWhatsApp(anamnese.whatsapp, msg), "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm">Análise com IA</h3>
        <Button size="sm" onClick={analisar} disabled={analisando}>
          {analisando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {recomendacao ? "Gerar novamente" : "Analisar com IA"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A IA atua como especialista em bem-estar (nutrição, suplementação e medicina básica) e sugere produtos Herbalife
        alinhados ao objetivo. Revise e edite o texto antes de encaminhar ao prospecto.
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {recomendacao && (
        <>
          <Textarea value={recomendacao} onChange={(e) => setRecomendacao(e.target.value)} rows={10} className="text-sm" />
          <div className="flex justify-end">
            <Button onClick={enviar} disabled={!recomendacao.trim()}>
              <Send className="w-4 h-4 mr-2" />Encaminhar por WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );
}