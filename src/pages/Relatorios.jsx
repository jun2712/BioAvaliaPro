import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { db } from "@/api/dataClient";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, BarChart3 } from "lucide-react";
import { calcularIdade } from "@/lib/bioRefs";
import { downloadCSV } from "@/lib/csv";

const RELATORIOS = [
  { key: "peso", label: "Distribuição de peso", unidade: "kg", fonte: "avaliacao", bins: [[null, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 100], [100, null]] },
  { key: "idade", label: "Distribuição de idade", unidade: "anos", fonte: "cliente", bins: [[null, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, null]] },
  { key: "gordura_corporal", label: "Gordura corporal", unidade: "%", fonte: "avaliacao", bins: [[null, 10], [10, 20], [20, 30], [30, 40], [40, null]] },
  { key: "musculo", label: "Músculo", unidade: "%", fonte: "avaliacao", bins: [[null, 25], [25, 30], [30, 35], [35, 40], [40, 45], [45, null]] },
  { key: "imc", label: "IMC", unidade: "", fonte: "avaliacao", bins: [[null, 18.5], [18.5, 25], [25, 30], [30, 35], [35, null]] },
];

const rotuloFaixa = (bin, unidade) => {
  const [min, max] = bin;
  const u = unidade ? " " + unidade : "";
  if (min == null) return `< ${max}${u}`;
  if (max == null) return `≥ ${min}${u}`;
  return `${min} – ${max}${u}`;
};

export default function Relatorios() {
  const [tipo, setTipo] = useState("peso");
  const [coachFiltro, setCoachFiltro] = useState("todos");
  const [sexoFiltro, setSexoFiltro] = useState("todos");
  const [clientes, setClientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cls, avs] = await Promise.all([
          db.entities.Cliente.list("-updated_date", 500),
          db.entities.Avaliacao.list("-updated_date", 1000),
        ]);
        setClientes(cls);
        setAvaliacoes(avs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const config = RELATORIOS.find((r) => r.key === tipo);

  const coaches = [...new Set(clientes.map((c) => (c.coach || "").trim()).filter(Boolean))].sort();
  const clientesFiltrados = useMemo(
    () => (coachFiltro === "todos" ? clientes : clientes.filter((c) => (c.coach || "").trim() === coachFiltro)),
    [clientes, coachFiltro]
  );

  // Última avaliação de cada cliente (por data).
  const ultimaPorCliente = useMemo(() => {
    const mapa = new Map();
    avaliacoes.forEach((a) => {
      const prev = mapa.get(a.cliente_id);
      if (!prev || a.data > prev.data) mapa.set(a.cliente_id, a);
    });
    return mapa;
  }, [avaliacoes]);

  // Alternador por sexo no topo: Todos / Homens / Mulheres.
  const clientesPorSexo = useMemo(
    () => (sexoFiltro === "todos" ? clientesFiltrados : clientesFiltrados.filter((c) => c.sexo === sexoFiltro)),
    [clientesFiltrados, sexoFiltro]
  );

  const valores = useMemo(() => {
    if (!config) return [];
    if (config.fonte === "cliente") {
      return clientesPorSexo.map((c) => calcularIdade(c.data_nascimento)).filter((v) => v != null);
    }
    const ids = new Set(clientesPorSexo.map((c) => c.id));
    return [...ultimaPorCliente.values()]
      .filter((a) => ids.has(a.cliente_id))
      .map((a) => a[config.key])
      .filter((v) => v != null && !isNaN(v));
  }, [clientesPorSexo, ultimaPorCliente, tipo]);

  const media = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
  const estatisticas = {
    total: valores.length,
    media: media != null ? Math.round(media * 10) / 10 : null,
    min: valores.length ? Math.min(...valores) : null,
    max: valores.length ? Math.max(...valores) : null,
  };

  const distribuicao = (config?.bins || []).map((bin) => {
    const [min, max] = bin;
    const quantidade = valores.filter((v) => (min == null || v >= min) && (max == null || v < max)).length;
    return { faixa: rotuloFaixa(bin, config.unidade), quantidade };
  });

  const exportar = () => {
    downloadCSV(`relatorio-${tipo}.csv`, ["Faixa", "Quantidade", "Percentual"],
      distribuicao.map((d) => ({
        "Faixa": d.faixa,
        "Quantidade": d.quantidade,
        "Percentual": estatisticas.total ? `${Math.round((d.quantidade / estatisticas.total) * 1000) / 10}%` : "0%",
      })));
  };

  return (
    <AppShell
      title="Relatórios"
      subtitle="Estatísticas da carteira de clientes (última avaliação de cada cliente)"
      actions={
        <Button variant="outline" onClick={exportar} disabled={loading || !estatisticas.total}>
          <Download className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      }
    >
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="max-w-xs space-y-1.5">
          <Label>Relatório</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATORIOS.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {coaches.length > 1 && (
          <div className="max-w-xs space-y-1.5">
            <Label>Coach</Label>
            <Select value={coachFiltro} onValueChange={setCoachFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os coaches</SelectItem>
                {coaches.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Sexo</Label>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {[["todos", "Todos"], ["Masculino", "Homens"], ["Feminino", "Mulheres"]].map(([valor, rotulo]) => (
              <button key={valor} type="button" onClick={() => setSexoFiltro(valor)}
                className={`h-10 px-4 rounded-md text-sm font-medium transition-colors ${sexoFiltro === valor ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : estatisticas.total === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Sem dados para este relatório</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre clientes e registre avaliações para gerar as estatísticas.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ["Clientes", estatisticas.total, ""],
              ["Média", estatisticas.media, config.unidade],
              ["Mínimo", estatisticas.min, config.unidade],
              ["Máximo", estatisticas.max, config.unidade],
            ].map(([lbl, valor, suf]) => (
              <Card key={lbl} className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{lbl}</p>
                <p className="text-2xl font-semibold mt-1">{valor}{suf ? ` ${suf}` : ""}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 mb-6">
            <h3 className="font-semibold mb-4">{config.label}</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribuicao} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="quantidade" name="Clientes" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Distribuição por faixa</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Faixa</th>
                  <th className="pb-2 font-medium text-right">Clientes</th>
                  <th className="pb-2 font-medium text-right">Percentual</th>
                </tr>
              </thead>
              <tbody>
                {distribuicao.map((d) => (
                  <tr key={d.faixa} className="border-b last:border-0">
                    <td className="py-2">{d.faixa}</td>
                    <td className="py-2 text-right font-medium">{d.quantidade}</td>
                    <td className="py-2 text-right">{Math.round((d.quantidade / estatisticas.total) * 1000) / 10}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}