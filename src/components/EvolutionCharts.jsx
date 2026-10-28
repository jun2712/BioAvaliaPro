import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseDataLocal } from "@/lib/datas";
import { Activity, Ruler, Weight, Cake, PersonStanding } from "lucide-react";

const fmtData = (d) => {
  if (!d) return "";
  const dt = parseDataLocal(d);
  return isNaN(dt) ? "" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

// Idade que o cliente tinha na data de referência (data da avaliação).
const idadeNaData = (nascimento, ref) => {
  if (!nascimento || !ref) return null;
  const nasc = parseDataLocal(nascimento);
  const d = parseDataLocal(ref);
  if (!nasc || !d) return null;
  let idade = d.getFullYear() - nasc.getFullYear();
  const m = d.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < nasc.getDate())) idade--;
  return idade;
};

const GRUPOS = [
  {
    titulo: "Peso corporal",
    icon: <Weight className="w-4 h-4 text-primary" />,
    metrics: [
      { key: "peso", label: "Peso (kg)", color: "#0ea5e9" },
      { key: "imc", label: "IMC", color: "#6366f1" },
    ],
  },
  {
    titulo: "Composição corporal",
    icon: <Activity className="w-4 h-4 text-primary" />,
    metrics: [
      { key: "musculo", label: "Músculo (%)", color: "#10b981" },
      { key: "gordura_corporal", label: "Gordura corporal (%)", color: "#f59e0b" },
      { key: "gordura_visceral", label: "Gordura visceral", color: "#ef4444" },
    ],
  },
  {
    titulo: "Idade corporal vs idade real",
    icon: <Cake className="w-4 h-4 text-primary" />,
    metrics: [
      { key: "idade_corporal", label: "Idade corporal (anos)", color: "#f97316" },
      { key: "idade_real", label: "Idade real (anos)", color: "#0ea5e9" },
    ],
  },
  {
    titulo: "Medidas — corpo",
    apenasAtivas: true,
    icon: <Ruler className="w-4 h-4 text-primary" />,
    metrics: [
      { key: "pescoco", label: "Pescoço", color: "#14b8a6" },
      { key: "torax", label: "Tórax", color: "#0ea5e9" },
      { key: "cintura", label: "Cintura", color: "#6366f1" },
      { key: "abdome", label: "Abdome", color: "#10b981" },
      { key: "quadril", label: "Quadril", color: "#f59e0b" },
      { key: "femur", label: "Fêmur", color: "#eab308" },
    ],
  },
  {
    titulo: "Medidas — membros",
    apenasAtivas: true,
    icon: <PersonStanding className="w-4 h-4 text-primary" />,
    full: true,
    metrics: [
      { key: "braco_direito", label: "Braço D", color: "#0ea5e9" },
      { key: "braco_esquerdo", label: "Braço E", color: "#6366f1" },
      { key: "antebraco_direito", label: "Antebraço D", color: "#06b6d4" },
      { key: "antebraco_esquerdo", label: "Antebraço E", color: "#84cc16" },
      { key: "coxa_direita", label: "Coxa D", color: "#10b981" },
      { key: "coxa_esquerda", label: "Coxa E", color: "#f59e0b" },
      { key: "panturrilha_direita", label: "Panturrilha D", color: "#ef4444" },
      { key: "panturrilha_esquerda", label: "Panturrilha E", color: "#8b5cf6" },
      { key: "punho", label: "Punho", color: "#ec4899" },
    ],
  },
];

// Só considera valores realmente lançados: medida vazia nunca entra na escala.
const temValor = (d, key) => d[key] != null && d[key] !== "" && !isNaN(Number(d[key]));

function Chart({ data, metrics, title, icon, full }) {
  // Escala do eixo Y ajustada à faixa real dos valores (com margem),
  // ignorando as avaliações sem valor lançado para a medida.
  const valores = data.flatMap((d) => metrics.filter((m) => temValor(d, m.key)).map((m) => Number(d[m.key])));
  let domain = ["auto", "auto"];
  if (valores.length) {
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const margem = Math.max((max - min) * 0.15, 1);
    domain = [Math.floor(min - margem), Math.ceil(max + margem)];
  }
  return (
    <Card className={cn("p-5", full && "lg:col-span-2")}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={domain} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {metrics.map((m) => (
              <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color}
                strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function EvolutionCharts({ avaliacoes, cliente, medidas = null }) {
  const chartData = avaliacoes.map((a) => ({
    ...a,
    data: fmtData(a.data),
    idade_real: idadeNaData(cliente?.data_nascimento, a.data),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {GRUPOS.map((g) => {
        const ativas = medidas && g.apenasAtivas ? g.metrics.filter((m) => medidas.includes(m.key)) : g.metrics;
        // Métricas sem nenhum valor lançado não geram linha nem afetam a escala.
        const metrics = ativas.filter((m) => chartData.some((d) => temValor(d, m.key)));
        if (!metrics.length) return null;
        return <Chart key={g.titulo} data={chartData} metrics={metrics} title={g.titulo} icon={g.icon} full={g.full} />;
      })}
    </div>
  );
}