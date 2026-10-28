import React from "react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const fmt = (v) => (v == null || v === "" ? "—" : String(v));

export default function ConflictList({ conflitos, escolhas, onEscolha, getTitulo }) {
  return (
    <div className="space-y-3">
      {conflitos.map((c, i) => (
        <Card key={i} className="p-4 space-y-3">
          <p className="font-medium text-sm">{getTitulo(c)}</p>
          <div className="overflow-x-auto rounded-lg border text-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left font-medium">Campo</th>
                  <th className="p-2 text-left font-medium">Atual no app</th>
                  <th className="p-2 text-left font-medium">Na planilha</th>
                </tr>
              </thead>
              <tbody>
                {c.difs.map((d, j) => (
                  <tr key={j} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{d.label}</td>
                    <td className="p-2">{fmt(d.antes)}</td>
                    <td className="p-2 font-medium">{fmt(d.depois)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RadioGroup value={escolhas[i] || "manter"} onValueChange={(v) => onEscolha(i, v)}>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manter" id={`conf-${i}-manter`} />
                <Label htmlFor={`conf-${i}-manter`}>Manter os dados do app</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="substituir" id={`conf-${i}-substituir`} />
                <Label htmlFor={`conf-${i}-substituir`}>Substituir pelos dados da planilha</Label>
              </div>
            </div>
          </RadioGroup>
        </Card>
      ))}
    </div>
  );
}