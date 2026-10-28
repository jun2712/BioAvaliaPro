import React from "react";

// Grupo de opções em cartões: alvos grandes, claros para preencher no celular.
export default function OptionGroup({ titulo, ajuda, opcoes, value, onChange }) {
  return (
    <div>
      <p className="font-medium">{titulo}</p>
      {ajuda && <p className="text-xs text-muted-foreground mt-0.5">{ajuda}</p>}
      <div className="grid gap-2 sm:grid-cols-2 mt-2">
        {opcoes.map((o) => {
          const ativo = value === o.value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              aria-pressed={ativo}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                ativo
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "bg-card hover:border-primary/40 hover:bg-muted/60"
              }`}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              {o.detalhe && <span className="block text-xs text-muted-foreground mt-0.5">{o.detalhe}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}