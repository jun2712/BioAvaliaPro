import React from "react";
import MetricField from "./MetricField";
import { MEDIDAS_PERIOMETRIA } from "@/lib/medidas";
import useMedidasAtivas from "@/hooks/useMedidasAtivas";

export default function PeriometriaFields({ values, onChange }) {
  const medidasAtivas = useMedidasAtivas();
  const lista = MEDIDAS_PERIOMETRIA.filter((m) => !medidasAtivas || medidasAtivas.includes(m.name));

  if (medidasAtivas && lista.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma medida ativa. Ajuste em Configurações.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {lista.map((m) => (
        <MetricField
          key={m.name}
          label={m.label}
          suffix="cm"
          name={m.name}
          value={values[m.name]}
          onChange={onChange}
          info={{ referencia: "Medida em centímetros" }}
          placeholder="—"
        />
      ))}
    </div>
  );
}