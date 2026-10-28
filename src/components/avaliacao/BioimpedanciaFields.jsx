import React from "react";
import MetricField from "./MetricField";
import { calcularImc, getMusculoFaixa, getImcFaixa, getGorduraFaixa, getVisceralFaixa, getMetabolismoRef, EXPLICACOES } from "@/lib/bioRefs";

// Campos na mesma ordem em que os índices aparecem na balança de bioimpedância.
export default function BioimpedanciaFields({ values, cliente, onChange }) {
  const idade = cliente?.idade || null;
  const sexo = cliente?.sexo || "Masculino";
  // A avaliação tem a própria altura; sem valor lançado, usa a do cadastro.
  const altura = values.altura || cliente?.altura;
  const imc = calcularImc(values.peso, altura);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricField label="Peso" suffix="kg" name="peso" value={values.peso} onChange={onChange}
        info={{ referencia: "Peso atual do cliente" }} explicacao={EXPLICACOES.peso} placeholder="Ex: 70,5" />
      <MetricField label="Altura" suffix="cm" name="altura" step="1" inputMode="numeric" value={values.altura ?? ""} onChange={onChange}
        info={{ referencia: "Altura desta avaliação; ao salvar, passa a ser a referência do cadastro" }} explicacao={EXPLICACOES.altura}
        placeholder={cliente?.altura ? `Ref: ${cliente.altura}` : "Ex: 172"} />
      <MetricField label="Gordura corporal" suffix="%" name="gordura_corporal" value={values.gordura_corporal} onChange={onChange}
        info={getGorduraFaixa(sexo, idade, values.gordura_corporal)} explicacao={EXPLICACOES.gordura_corporal} placeholder="Ex: 22,0" />
      <MetricField label="Músculo" suffix="%" name="musculo" value={values.musculo} onChange={onChange}
        info={getMusculoFaixa(sexo, idade, values.musculo)} explicacao={EXPLICACOES.musculo} placeholder="Ex: 32,1" />
      <MetricField label="Gordura visceral" suffix="nível" name="gordura_visceral" step="1" value={values.gordura_visceral} onChange={onChange}
        info={getVisceralFaixa(values.gordura_visceral)} explicacao={EXPLICACOES.gordura_visceral} placeholder="Ex: 7" />
      <MetricField label="Metabolismo basal" suffix="kcal" name="metabolismo_basal" value={values.metabolismo_basal} onChange={onChange}
        info={getMetabolismoRef(sexo, idade, values.peso, altura)} explicacao={EXPLICACOES.metabolismo_basal} placeholder="Ex: 1600" />
      <MetricField label="Idade metabólica" suffix="anos" name="idade_corporal" value={values.idade_corporal} onChange={onChange}
        info={{ referencia: "Idade metabólica estimada pela balança" }} explicacao={EXPLICACOES.idade_corporal} placeholder="Ex: 30" />
      <MetricField label="IMC" suffix="kg/m²" name="imc" value={imc} readOnly onChange={() => {}}
        info={getImcFaixa(imc)} explicacao={EXPLICACOES.imc} placeholder="Calculado" />
    </div>
  );
}