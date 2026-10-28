import React from "react";
import { Card } from "@/components/ui/card";
import { Beef, Utensils } from "lucide-react";
import { formatarFator, faixaRefeicao, ORIENTACAO_LEUCINA, ORIENTACAO_FONTES } from "@/lib/proteina";

// Plano proteico completo: meta diária, faixa por refeição, fracionamento e orientações.
export default function ProteinaResultado({ resultado }) {
  if (!resultado) return null;

  return (
    <Card className="p-6 border-primary/40 bg-primary/5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Sua meta diária estimada</p>
      <p className="font-heading text-5xl font-semibold tracking-tight mt-1">
        {resultado.gramas_dia ?? "—"}
        <span className="text-2xl font-medium ml-1">g</span>
      </p>
      <p className="text-sm mt-2">
        de proteína por dia — fator de <strong>{formatarFator(resultado.fator)}</strong>
        {resultado.peso ? ` sobre ${resultado.peso} kg` : ""}
        {resultado.idade ? ` · ${resultado.idade} anos` : ""}.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Utensils className="w-3 h-3" />Por refeição
          </p>
          <p className="text-lg font-semibold mt-0.5">{faixaRefeicao(resultado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Beef className="w-3 h-3" />Refeições/dia
          </p>
          <p className="text-lg font-semibold mt-0.5">{resultado.refeicoes ?? "—"}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2 text-sm">
        <p>
          <strong>Leucina:</strong> {ORIENTACAO_LEUCINA}
        </p>
        <p>
          <strong>Fontes sugeridas:</strong> {ORIENTACAO_FONTES}
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Estimativa informativa baseada em diretrizes de envelhecimento (PROT-AGE / ESPEN), atividade física
        e terapia com GLP-1. Não substitui a avaliação e a prescrição do seu nutricionista ou médico.
      </p>
    </Card>
  );
}