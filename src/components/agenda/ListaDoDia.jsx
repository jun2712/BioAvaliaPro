import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cake, MessageCircle, CalendarClock, X } from "lucide-react";
import { calcularIdade } from "@/lib/bioRefs";

// Lista de aniversários e avaliações agendadas do dia selecionado no calendário
export default function ListaDoDia({ titulo, aniversariantes = [], agendados = [], onParabens, onCancelar, onReagendar }) {
  const vazio = aniversariantes.length === 0 && agendados.length === 0;
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-sm mb-3">{titulo}</h2>
      {vazio ? (
        <p className="text-sm text-muted-foreground text-center border border-dashed rounded-lg py-10">
          Nenhum aniversário ou avaliação agendada neste dia.
        </p>
      ) : (
        <div className="space-y-3">
          {aniversariantes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap border rounded-lg p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Cake className="w-4 h-4 text-pink-500 shrink-0" />
                  <p className="font-medium truncate">{c.nome}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {calcularIdade(c.data_nascimento)} anos{c.whatsapp ? ` · ${c.whatsapp}` : ""}
                </p>
              </div>
              <Button size="sm" onClick={() => onParabens?.(c)}>
                <MessageCircle className="w-4 h-4 mr-1.5" />Parabéns
              </Button>
            </div>
          ))}
          {agendados.map((a) => (
            <div key={a.id} className="flex items-center gap-2 border rounded-lg p-3">
              <CalendarClock className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{a.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Avaliação agendada{a.hora ? ` · ${a.hora}` : ""}</p>
              </div>
              {onReagendar && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onReagendar(a)}>
                  Reagendar
                </Button>
              )}
              {onCancelar && (
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => onCancelar(a)} title="Cancelar agendamento">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}