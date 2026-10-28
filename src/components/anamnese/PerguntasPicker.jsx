import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIAS_ANAMNESE, PERGUNTAS_ANAMNESE } from "@/lib/anamneseBank";

function FiltroChip({ label, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        ativo ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

// Seleção de perguntas: chips de categoria selecionam o conjunto pré-definido do filtro.
export default function PerguntasPicker({ selecionadas, onToggle, onLimpar, conjuntos = [] }) {
  const [filtro, setFiltro] = useState("todas");

  const lista = filtro === "todas"
    ? PERGUNTAS_ANAMNESE
    : filtro === "selecionadas"
      ? PERGUNTAS_ANAMNESE.filter((p) => selecionadas.has(p.codigo))
      : PERGUNTAS_ANAMNESE.filter((p) => p.categoria === filtro);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FiltroChip label="Todas" ativo={filtro === "todas"} onClick={() => setFiltro("todas")} />
        {CATEGORIAS_ANAMNESE.map((cat) => (
          <FiltroChip
            key={cat}
            label={cat}
            ativo={filtro === cat}
            onClick={() => {
              setFiltro(cat);
              PERGUNTAS_ANAMNESE
                .filter((p) => p.categoria === cat)
                .forEach((p) => {
                  if (!selecionadas.has(p.codigo)) onToggle(p.codigo, true);
                });
            }}
          />
        ))}
        {conjuntos.map((cj) => (
          <FiltroChip
            key={cj.id}
            label={`★ ${cj.nome}`}
            ativo={false}
            onClick={() => {
              (cj.codigos || []).forEach((cod) => {
                if (!selecionadas.has(cod)) onToggle(cod, true);
              });
              setFiltro("selecionadas");
            }}
          />
        ))}
        <FiltroChip label={`Selecionadas (${selecionadas.size})`} ativo={filtro === "selecionadas"} onClick={() => setFiltro("selecionadas")} />
        {selecionadas.size > 0 && (
          <button type="button" onClick={onLimpar} className="text-xs text-destructive underline underline-offset-2 ml-1">
            Limpar seleção
          </button>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto rounded-lg border divide-y">
        {lista.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma pergunta nesta visão.</p>
        ) : (
          lista.map((p) => (
            <label key={p.codigo} className="flex items-start gap-3 p-2.5 hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={selecionadas.has(p.codigo)}
                onCheckedChange={(c) => onToggle(p.codigo, !!c)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{p.categoria}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{p.codigo}</span>
                  {p.tipo === "select" ? (
                    <span className="text-[10px] text-muted-foreground">dropdown</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">texto aberto</span>
                  )}
                </div>
                <p className="text-sm mt-0.5">{p.pergunta}</p>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}