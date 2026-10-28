import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AnaliseIA from "@/components/anamnese/AnaliseIA";
import MetaProteicaCard from "@/components/MetaProteicaCard";

// Exibe as respostas de uma anamnese preenchida.
export default function RespostasView({ anamnese, open, onClose }) {
  const meta = anamnese?.meta_proteica;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anamnese de {anamnese?.nome || "cliente"}</DialogTitle>
        </DialogHeader>

        {meta && (
          <MetaProteicaCard
            meta={meta}
            nota={
              meta.prospecto_criado
                ? "Novo prospecto criado com o resultado salvo na ficha"
                : "Resultado salvo na ficha do cliente"
            }
          />
        )}

        <div className="space-y-3">
          {(anamnese?.perguntas || []).map((p) => (
            <div key={p.codigo} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{p.categoria}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{p.codigo}</span>
              </div>
              <p className="text-sm font-medium mt-1">{p.pergunta}</p>
              <p className={`text-sm mt-1 ${p.resposta ? "text-foreground" : "text-muted-foreground"}`}>
                {p.resposta || "— sem resposta —"}
              </p>
            </div>
          ))}
        </div>
        {anamnese?.status === "respondida" && (
          <div className="pt-4 mt-4 border-t">
            <AnaliseIA anamnese={anamnese} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}