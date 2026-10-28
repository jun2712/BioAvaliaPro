import React from "react";
import EvolutionCharts from "@/components/EvolutionCharts";
import MetaProteicaCard from "@/components/MetaProteicaCard";
import FieldRef from "@/components/avaliacao/FieldRef";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { calcularIdade, calcularImc, getMusculoFaixa, getImcFaixa, getGorduraFaixa, getVisceralFaixa, getNavyFaixa, calcularRcq, classificarRcq, getMetasComposicao, EXPLICACOES } from "@/lib/bioRefs";
import { calcularNavy } from "@/lib/navy";
import { Activity, Ruler, EyeOff, History, Pencil, Trash2, Target, User, Percent, AlertTriangle } from "lucide-react";
import ConfirmButton from "@/components/ConfirmButton";
import AvatarCorporal from "@/components/AvatarCorporal";
import useMedidasAtivas from "@/hooks/useMedidasAtivas";
import InfoTooltip from "@/components/InfoTooltip";
import { MEDIDAS_PERIOMETRIA } from "@/lib/medidas";
import { formatarDataBR } from "@/lib/datas";
import { TIPO_AVALIACAO_LABEL } from "@/lib/fluxo";

function Dado({ label, valor, suffix, info, explicacao }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {label}
        {explicacao && <InfoTooltip texto={explicacao} />}
      </p>
      <p className="text-lg font-semibold mt-0.5">{valor != null ? `${valor}${suffix ? ` ${suffix}` : ""}` : "—"}</p>
      {info && <FieldRef info={info} />}
    </div>
  );
}

export default function ReportContent({ cliente, avaliacoes, mostrarNotasPrivadas = false, medidasExternas = null, mostrarNavy = true, metaProteica = null, onEditarUltima, onAbrirAvaliacao, onExcluirAvaliacao }) {
  const medidasHook = useMedidasAtivas();
  const medidasAtivas = medidasExternas ?? medidasHook;
  const ultima = avaliacoes[avaliacoes.length - 1];
  if (!ultima) return null;

  const idade = calcularIdade(cliente.data_nascimento);
  const imc = ultima.imc ?? calcularImc(ultima.peso, cliente.altura);
  const temEvolucao = avaliacoes.length >= 2;

  return (
    <>
      {/* Última avaliação */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Última avaliação</h2>
          <p className="text-sm text-muted-foreground">{formatarDataBR(ultima.data)}</p>
        </div>
        {onEditarUltima && (
          <Button variant="outline" size="sm" onClick={onEditarUltima}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
          </Button>
        )}
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-primary" /><h3 className="font-semibold">Bioimpedância</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Dado label="Peso" valor={ultima.peso} suffix="kg" info={{ referencia: "Peso atual" }} explicacao={EXPLICACOES.peso} />
          <Dado label="Gordura corporal" valor={ultima.gordura_corporal} suffix="%" info={getGorduraFaixa(cliente.sexo, idade, ultima.gordura_corporal)} explicacao={EXPLICACOES.gordura_corporal} />
          <Dado label="Músculo" valor={ultima.musculo} suffix="%" info={getMusculoFaixa(cliente.sexo, idade, ultima.musculo)} explicacao={EXPLICACOES.musculo} />
          <Dado label="Gordura visceral" valor={ultima.gordura_visceral} info={getVisceralFaixa(ultima.gordura_visceral)} explicacao={EXPLICACOES.gordura_visceral} />
          <Dado label="Metabolismo basal" valor={ultima.metabolismo_basal} suffix="kcal" info={{ referencia: "Gasto energético em repouso" }} explicacao={EXPLICACOES.metabolismo_basal} />
          <Dado label="Idade metabólica" valor={ultima.idade_corporal} suffix="anos" info={{ referencia: "Idade metabólica estimada pela balança" }} explicacao={EXPLICACOES.idade_corporal} />
          <Dado label="IMC" valor={imc} info={getImcFaixa(imc)} explicacao={EXPLICACOES.imc} />
        </div>
      </Card>

      {(!medidasAtivas || MEDIDAS_PERIOMETRIA.some((m) => medidasAtivas.includes(m.name))) && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4"><Ruler className="w-4 h-4 text-primary" /><h3 className="font-semibold">Periometria (cm)</h3></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {MEDIDAS_PERIOMETRIA
              .filter((m) => !medidasAtivas || medidasAtivas.includes(m.name))
              .map((m) => (
                <div key={m.name} className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">{m.curto}</span>
                  <span className="font-medium">{ultima[m.name] != null ? `${ultima[m.name]} cm` : "—"}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {metaProteica && <MetaProteicaCard meta={metaProteica} className="mb-6" />}

      {/* Composição corporal e metas */}
      {(() => {
        const rcq = calcularRcq(ultima.cintura, ultima.quadril);
        const rcqInfo = classificarRcq(cliente.sexo, idade, rcq);
        const metas = getMetasComposicao(cliente.sexo, idade, ultima);
        if (rcq == null && metas.musculoKg == null && metas.gorduraKg == null) return null;
        const partes = [];
        if (metas.ganharMusculoKg > 0) partes.push(`ganhar ≈ ${metas.ganharMusculoKg} kg de músculo`);
        if (metas.reduzirGorduraKg > 0) partes.push(`reduzir ≈ ${metas.reduzirGorduraKg} kg de gordura`);
        return (
          <Card className="p-5 mb-6">
            <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-primary" /><h3 className="font-semibold">Composição corporal e metas</h3></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rcq != null && <Dado label="Relação Cintura-Quadril" valor={rcq} info={rcqInfo} />}
              {metas.musculoKg != null && (
                <Dado label="Músculo" valor={metas.musculoKg} suffix="kg"
                  info={metas.ganharMusculoKg > 0 ? { referencia: `Meta: ganhar ${metas.ganharMusculoKg} kg` } : { referencia: metas.refMusculo }} />
              )}
              {metas.gorduraKg != null && (
                <Dado label="Gordura corporal" valor={metas.gorduraKg} suffix="kg"
                  info={metas.reduzirGorduraKg > 0 ? { referencia: `Meta: reduzir ${metas.reduzirGorduraKg} kg` } : { referencia: metas.refGordura }} />
              )}
            </div>
            {partes.length > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
                Para alcançar a faixa de referência: {partes.join(" e ")}.
              </p>
            )}
          </Card>
        );
      })()}

      {/* Avaliação por medidas (U.S. Navy) e indicadores de risco */}
      {(() => {
        if (mostrarNavy === false) return null;
        const cinturaAtiva = !medidasAtivas || medidasAtivas.includes("cintura");
        const alturaRef = ultima.altura || cliente.altura;
        const navy = ultima.navy_gordura != null
          ? { ok: true, gordura: ultima.navy_gordura, massaGorda: ultima.navy_massa_gorda, massaMagra: ultima.navy_massa_magra }
          : calcularNavy(cliente.sexo, alturaRef, ultima.peso, ultima.cintura, ultima.pescoco, ultima.quadril);
        if (!navy.ok && !(cinturaAtiva && ultima.cintura != null)) return null;
        const rca = ultima.cintura != null && alturaRef ? Math.round((ultima.cintura / alturaRef) * 100) / 100 : null;
        const riscoCintura = rca != null && rca > 0.5;
        const faixa = navy.ok ? getNavyFaixa(cliente.sexo, navy.gordura) : null;
        return (
          <Card className="p-5 mb-6">
            <div className="flex items-center gap-2 mb-4"><Percent className="w-4 h-4 text-primary" /><h3 className="font-semibold">Avaliação por medidas (U.S. Navy)</h3></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Dado label="Gordura por medidas" valor={navy.ok ? navy.gordura : null} suffix="%"
                info={faixa ?? { referencia: "Protocolo U.S. Navy" }} explicacao="Percentual de gordura estimado pela fita métrica (cintura, pescoço e quadril), sem a balança." />
              <Dado label="Massa gorda" valor={navy.ok ? navy.massaGorda : null} suffix="kg" />
              <Dado label="Massa livre de gordura" valor={navy.ok ? navy.massaMagra : null} suffix="kg" />
              {rca != null && (
                <Dado label="Cintura / Altura" valor={rca}
                  info={{ referencia: riscoCintura ? "Acima do limite de risco" : "Limite de risco: cintura acima de metade da altura" }} />
              )}
            </div>
            {riscoCintura && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Cintura acima de metade da altura — indicador de risco à saúde. Recomenda-se acompanhamento.
              </p>
            )}
            {!navy.ok && (
              <p className="text-xs text-muted-foreground mt-3">
                Percentual por medidas não calculado nesta avaliação: as medidas exigidas pelo protocolo não foram lançadas.
              </p>
            )}
          </Card>
        );
      })()}

      {/* Seu Avatar */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><User className="w-4 h-4 text-primary" /><h3 className="font-semibold">Seu Avatar</h3></div>
        <AvatarCorporal cliente={cliente} avaliacao={ultima} imc={imc} />
      </Card>

      {(ultima.observacoes_cliente || (mostrarNotasPrivadas && ultima.notas_profissional)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {ultima.observacoes_cliente && (
            <Card className="p-5">
              <h3 className="font-semibold mb-2">Observações do Cliente</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ultima.observacoes_cliente}</p>
            </Card>
          )}
          {mostrarNotasPrivadas && ultima.notas_profissional && (
            <Card className="p-5 border-amber-200 bg-amber-50/40">
              <div className="flex items-center gap-2 mb-2"><EyeOff className="w-4 h-4 text-amber-600" /><h3 className="font-semibold">Notas do Profissional (privado)</h3></div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ultima.notas_profissional}</p>
            </Card>
          )}
        </div>
      )}

      {/* Evolução */}
      {temEvolucao && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4"><History className="w-4 h-4 text-primary" /><h2 className="font-semibold text-lg">Evolução no tempo</h2></div>
          <EvolutionCharts avaliacoes={avaliacoes} cliente={cliente} medidas={medidasAtivas} />
        </div>
      )}

      {/* Histórico */}
      <div>
        <h3 className="font-semibold mb-3">Histórico de avaliações</h3>
        <div className="space-y-2">
          {avaliacoes.slice().reverse().map((a) => (
            <Card key={a.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {formatarDataBR(a.data)}
                  {a.tipo && <span className="ml-2 text-[11px] font-normal rounded-full border bg-muted px-2 py-0.5 text-muted-foreground">{TIPO_AVALIACAO_LABEL[a.tipo]}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.peso ? `${a.peso} kg` : "—"}{a.imc ? ` · IMC ${a.imc}` : ""}{a.gordura_corporal ? ` · Gordura ${a.gordura_corporal}%` : ""}{a.musculo ? ` · Músculo ${a.musculo}%` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {onAbrirAvaliacao && (
                  <Button variant="ghost" size="sm" onClick={() => onAbrirAvaliacao(a)}>Ver / editar</Button>
                )}
                {onExcluirAvaliacao && (
                  <ConfirmButton
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Excluir avaliação">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    }
                    title="Excluir avaliação"
                    description={`A avaliação de ${formatarDataBR(a.data)} será removida permanentemente. Esta ação não pode ser desfeita.`}
                    onConfirm={() => onExcluirAvaliacao(a)}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}