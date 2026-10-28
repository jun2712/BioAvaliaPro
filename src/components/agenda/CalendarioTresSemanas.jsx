import React from "react";
import { Card } from "@/components/ui/card";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const chaveDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const chaveMesDia = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Calendário compacto de 3 semanas (anterior, atual e próxima) com marcadores
// de aniversários e avaliações agendadas. Clicar em um dia seleciona a data.
export default function CalendarioTresSemanas({ aniversarios = new Set(), agendados = new Set(), selecionada = null, onSelecionar }) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay() - 7);

  const semanas = Array.from({ length: 3 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + w * 7 + i);
      return { d, chave: chaveDia(d) };
    })
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="font-semibold text-sm">Três semanas</h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500" />Aniversário</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />Avaliação</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">Clique em um dia para ver os aniversários e avaliações.</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {semanas.map((sem, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {sem.map(({ d, chave }) => {
              const temAniv = aniversarios.has(chaveMesDia(d));
              const temAg = agendados.has(chave);
              const ehHoje = chave === chaveDia(hoje);
              const selecionado = selecionada === chave;
              const outroMes = d.getMonth() !== hoje.getMonth();
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => onSelecionar?.(chave)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs border transition-colors ${
                    selecionado
                      ? "border-primary bg-primary/15 font-semibold"
                      : ehHoje
                        ? "border-primary/40 bg-primary/5 font-semibold"
                        : outroMes
                          ? "border-transparent text-muted-foreground/50 hover:bg-muted"
                          : "border-transparent hover:bg-muted"
                  }`}
                >
                  <span>{d.getDate()}</span>
                  <div className="flex gap-0.5 mt-0.5 h-1.5">
                    {temAniv && <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />}
                    {temAg && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}