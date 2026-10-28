import React from "react";
import { cn } from "@/lib/utils";

const ESTILOS = {
  prospecto: "bg-amber-50 text-amber-700 border-amber-200",
  ativo: "bg-primary/20 text-primary-foreground border-primary/40",
  pausado: "bg-sky-50 text-sky-700 border-sky-200",
  encerrado: "bg-muted text-muted-foreground border-border",
};

const ROTULOS = {
  prospecto: "Prospecto",
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

// Selo do status do acompanhamento (prospecto, ativo, pausado ou encerrado).
export default function StatusBadge({ status, className }) {
  const chave = ROTULOS[status] ? status : "ativo";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ESTILOS[chave],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {ROTULOS[chave]}
    </span>
  );
}