import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BioimpedanciaFields from "@/components/avaliacao/BioimpedanciaFields";
import PeriometriaFields from "@/components/avaliacao/PeriometriaFields";
import NotasFields from "@/components/avaliacao/NotasFields";
import IndicadoresComposicao from "@/components/avaliacao/IndicadoresComposicao";
import NavyFields from "@/components/avaliacao/NavyFields";
import { ArrowLeft, Save, Loader2, Activity, Ruler, StickyNote, Target, Percent } from "lucide-react";
import { calcularImc, calcularIdade } from "@/lib/bioRefs";
import { calcularNavy } from "@/lib/navy";
import { dataHojeLocal } from "@/lib/datas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_AVALIACAO } from "@/lib/fluxo";

const hoje = () => dataHojeLocal();

export default function AvaliacaoForm() {
  const { id, clienteId } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [values, setValues] = useState({ data: hoje() });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (id) {
          const av = await base44.entities.Avaliacao.get(id);
          setValues({ ...av });
          if (av.cliente_id) setCliente(await base44.entities.Cliente.get(av.cliente_id));
        } else if (clienteId) {
          const c = await base44.entities.Cliente.get(clienteId);
          const avs = await base44.entities.Avaliacao.filter({ cliente_id: clienteId }, "data", 200);
          const ultima = avs[avs.length - 1];
          setCliente(c);
          // Altura de referência: a da avaliação mais recente; sem avaliações, a do cadastro
          setValues({
            data: hoje(),
            cliente_id: clienteId,
            altura: ultima?.altura ?? c?.altura ?? "",
            tipo: ultima ? "acompanhamento" : "inicial",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, clienteId]);

  const onChange = (name, val) => setValues((v) => ({ ...v, [name]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const alturaRef = values.altura ? Number(values.altura) : cliente?.altura ?? null;
      const imc = calcularImc(values.peso, alturaRef);
      // Resultados do método U.S. Navy ficam salvos na própria avaliação
      const navy = calcularNavy(cliente?.sexo, alturaRef, values.peso, values.cintura, values.pescoco, values.quadril);
      const payload = {
        ...values,
        altura: alturaRef,
        imc,
        cliente_id: values.cliente_id || clienteId,
        navy_gordura: navy.ok ? navy.gordura : null,
        navy_massa_gorda: navy.ok ? navy.massaGorda : null,
        navy_massa_magra: navy.ok ? navy.massaMagra : null,
      };
      let savedId = id;
      if (id) {
        await base44.entities.Avaliacao.update(id, payload);
      } else {
        const user = await base44.auth.me().catch(() => null);
        const coach = user?.coach_nome || user?.email || null;
        const created = await base44.entities.Avaliacao.create({ ...payload, coach });
        savedId = created.id;
      }
      // A altura lançada na avaliação passa a ser a referência do cadastro
      const ajustes = {};
      if (alturaRef != null && cliente && Number(alturaRef) !== Number(cliente.altura)) {
        ajustes.altura = Number(alturaRef);
      }
      // Retorno previsto cumprido: o cliente sai das pendências do painel
      if (cliente?.proxima_avaliacao && cliente.proxima_avaliacao <= (values.data || hoje())) {
        ajustes.proxima_avaliacao = null;
      }
      if (cliente && Object.keys(ajustes).length > 0) {
        await base44.entities.Cliente.update(cliente.id, ajustes);
      }
      navigate(`/cliente/${payload.cliente_id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppShell title="Avaliação"><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }

  const cli = { ...cliente, idade: calcularIdade(cliente?.data_nascimento) };

  return (
    <AppShell
      title={id ? "Editar avaliação" : "Nova avaliação"}
      actions={
        <>
          {/* No celular o botão vira só a seta, liberando espaço para os dados do cliente */}
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-6">
        {/* Identificação do cliente: sempre visível, sem truncamento */}
        {cliente && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-card border rounded-lg px-4 py-3">
            <span className="font-semibold">{cliente.nome}</span>
            {cliente.codigo && <span className="text-sm text-muted-foreground font-mono">{cliente.codigo}</span>}
            {cliente.sexo && <span className="text-sm text-muted-foreground">· {cliente.sexo}</span>}
            {cli?.idade != null && <span className="text-sm text-muted-foreground">· {cli.idade} anos</span>}
            {cliente?.altura ? <span className="text-sm text-muted-foreground">· Altura {cliente.altura} cm</span> : null}
          </div>
        )}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Bioimpedância</h2>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Data da avaliação</Label>
              <Input type="date" value={values.data || ""} onChange={(e) => onChange("data", e.target.value)} className="h-10 mt-1" required />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Tipo</Label>
              <Select value={values.tipo || "acompanhamento"} onValueChange={(v) => onChange("tipo", v)}>
                <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_AVALIACAO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <BioimpedanciaFields values={values} cliente={cli} onChange={onChange} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Periometria (medidas corporais)</h2>
          </div>
          <PeriometriaFields values={values} onChange={onChange} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Método U.S. Navy (avaliação por medidas)</h2>
          </div>
          <NavyFields values={values} cliente={cli} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Composição corporal e metas</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Cálculo automático a partir do peso, das porcentagens de músculo/gordura e das medidas de cintura e quadril informadas acima.
          </p>
          <IndicadoresComposicao values={values} cliente={cli} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <StickyNote className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Notas e observações</h2>
          </div>
          <NotasFields values={values} onChange={onChange} />
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar avaliação
          </Button>
        </div>
      </form>
    </AppShell>
  );
}