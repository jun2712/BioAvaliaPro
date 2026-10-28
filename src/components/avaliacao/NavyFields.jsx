import React from "react";
import MetricField from "./MetricField";
import { calcularNavy } from "@/lib/navy";

const rotulos = { altura: "altura", cintura: "cintura", pescoco: "pescoço", quadril: "quadril", peso: "peso" };

// Método U.S. Navy: %GC, massa gorda e massa livre de gordura calculados ao
// vivo a partir das medidas lançadas; sem dados completos, não há resultado.
export default function NavyFields({ values, cliente }) {
  const resultado = calcularNavy(
    cliente?.sexo,
    values.altura || cliente?.altura,
    values.peso,
    values.cintura,
    values.pescoco,
    values.quadril
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Percentual de gordura estimado pela fita métrica (protocolo U.S. Navy), usando cintura, pescoço
        {cliente?.sexo === "Feminino" ? " e quadril" : ""} com altura e peso. Mulheres: cintura na menor
        circunferência do abdômen; homens: na linha do umbigo.
      </p>
      {resultado.ok ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricField label="Gordura por medidas" suffix="%" name="_navy_gordura" value={resultado.gordura} readOnly onChange={() => {}}
            info={{ referencia: "Protocolo U.S. Navy" }} placeholder="Calculado" />
          <MetricField label="Massa gorda" suffix="kg" name="_navy_massa_gorda" value={resultado.massaGorda} readOnly onChange={() => {}}
            info={{ referencia: "Peso × %GC (U.S. Navy)" }} placeholder="Peso + %GC" />
          <MetricField label="Massa livre de gordura" suffix="kg" name="_navy_massa_magra" value={resultado.massaMagra} readOnly onChange={() => {}}
            info={{ referencia: "Peso − massa gorda" }} placeholder="Peso + %GC" />
        </div>
      ) : resultado.faltando.length ? (
        <p className="text-sm text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2">
          Para calcular, informe também: {resultado.faltando.map((k) => rotulos[k]).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}