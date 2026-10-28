import React from "react";
import MetricField from "./MetricField";
import { calcularRcq, classificarRcq, getMetasComposicao } from "@/lib/bioRefs";

// Cálculo ao vivo de RCQ e massa de músculo/gordura em kg, com metas.
export default function IndicadoresComposicao({ values, cliente }) {
  const rcq = calcularRcq(values.cintura, values.quadril);
  const rcqInfo = classificarRcq(cliente?.sexo, cliente?.idade, rcq);
  const metas = getMetasComposicao(cliente?.sexo, cliente?.idade, values);

  const partes = [];
  if (metas.ganharMusculoKg > 0) partes.push(`ganhar ≈ ${metas.ganharMusculoKg} kg de músculo`);
  if (metas.reduzirGorduraKg > 0) partes.push(`reduzir ≈ ${metas.reduzirGorduraKg} kg de gordura`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricField label="Relação Cintura-Quadril" name="_rcq" value={rcq} readOnly onChange={() => {}}
          info={rcqInfo} placeholder="Informe cintura e quadril" />
        <MetricField label="Músculo" suffix="kg" name="_musculo_kg" value={metas.musculoKg} readOnly onChange={() => {}}
          info={metas.musculoKg != null
            ? { referencia: metas.ganharMusculoKg > 0 ? `Meta: ${metas.ganharMusculoKg} kg de músculo` : metas.refMusculo }
            : null}
          placeholder="Peso + músculo %" />
        <MetricField label="Gordura corporal" suffix="kg" name="_gordura_kg" value={metas.gorduraKg} readOnly onChange={() => {}}
          info={metas.gorduraKg != null
            ? { referencia: metas.reduzirGorduraKg > 0 ? `Meta: ${metas.reduzirGorduraKg} kg de gordura` : metas.refGordura }
            : null}
          placeholder="Peso + gordura %" />
      </div>
      {partes.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Para alcançar a faixa de referência: {partes.join(" e ")}.
        </p>
      )}
    </div>
  );
}