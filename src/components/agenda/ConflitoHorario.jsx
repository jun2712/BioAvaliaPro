import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";

// Aviso de sobreposição de horários: lista o que já está agendado e sugere horários livres
export default function ConflitoHorario({ conflitos = [], livres = [], onEscolher, onConfirmar, saving }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900">Já existe atendimento neste horário</p>
          <ul className="text-xs text-amber-800 mt-1 space-y-0.5">
            {conflitos.map((c) => (
              <li key={c.id}>
                {c.hora}
                {c.nome ? ` · ${c.nome}` : ""}
                {c.tipoLabel ? ` · ${c.tipoLabel}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {livres.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-900 mb-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />Horários livres neste dia
          </p>
          <div className="flex flex-wrap gap-1.5">
            {livres.map((h) => (
              <Button
                key={h}
                type="button"
                variant="outline"
                className="h-8 px-2.5 bg-white"
                onClick={() => onEscolher?.(h)}
              >
                {h}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-9 px-3" onClick={onConfirmar} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          Agendar mesmo assim
        </Button>
        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onEscolher?.(null)}>
          Escolher outro horário
        </Button>
      </div>
    </div>
  );
}