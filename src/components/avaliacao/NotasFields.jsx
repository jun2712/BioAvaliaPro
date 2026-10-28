import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EyeOff, Eye } from "lucide-react";

export default function NotasFields({ values, onChange }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-600" />
          <Label className="text-sm font-semibold">Observações do Cliente</Label>
        </div>
        <p className="text-xs text-muted-foreground">Visível no relatório final entregue ao cliente.</p>
        <Textarea
          rows={6}
          value={values.observacoes_cliente || ""}
          onChange={(e) => onChange("observacoes_cliente", e.target.value)}
          placeholder="Recados, recomendações e devolutivas para o cliente..."
          className="resize-y"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-amber-600" />
          <Label className="text-sm font-semibold">Notas do Profissional</Label>
        </div>
        <p className="text-xs text-muted-foreground">Campo privado — visível apenas para o avaliador logado.</p>
        <Textarea
          rows={6}
          value={values.notas_profissional || ""}
          onChange={(e) => onChange("notas_profissional", e.target.value)}
          placeholder="Anotações internas, estratégias técnicas, histórico clínico..."
          className="resize-y"
        />
      </div>
    </div>
  );
}