import React from "react";
import { Card } from "@/components/ui/card";
import { Beef } from "lucide-react";
import { formatarFator, faixaRefeicao, rotuloOpcao, NIVEL_ATIVIDADE, OBJETIVO, SEXO } from "@/lib/proteina";
import { formatarDataBR } from "@/lib/datas";

// Resultado da meta proteica — usado no relatório do cliente e no relatório da anamnese.
export default function MetaProteicaCard({ meta, nota, className = "" }) {
  if (!meta || meta.gramas_dia == null) return null;

  const data = meta.calculado_em || meta.respondida_em;
  const contexto = [
    meta.peso != null ? `${meta.peso} kg` : null,
    meta.idade != null ? `${meta.idade} anos` : null,
    meta.sexo ? rotuloOpcao(SEXO, meta.sexo) : null,
    meta.nivel_atividade ? rotuloOpcao(NIVEL_ATIVIDADE, meta.nivel_atividade) : null,
    meta.objetivo ? rotuloOpcao(OBJETIVO, meta.objetivo) : null,
    meta.usa_glp1 ? "usa GLP-1" : null,
  ].filter(Boolean).join(" · ");

  const indicadores = [
    ["Meta diária", `${meta.gramas_dia} g`],
    ["Fator", formatarFator(meta.fator)],
    ["Por refeição", faixaRefeicao(meta)],
    ["Refeições", meta.refeicoes ?? "—"],
  ];

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Beef className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Meta proteica</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {indicadores.map(([label, valor]) => (
          <div key={label} className="rounded-xl border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold mt-0.5">{valor}</p>
          </div>
        ))}
      </div>
      {contexto && <p className="text-sm text-muted-foreground mt-3">{contexto}</p>}
      {(nota || data) && (
        <p className="text-xs text-muted-foreground mt-1">
          {nota || ""}
          {nota && data ? " · " : ""}
          {data ? `calculada em ${formatarDataBR(data)}` : ""}
        </p>
      )}
    </Card>
  );
}