import React from "react";
import KpiCard from "@/components/painel/KpiCard";
import { Users, Activity, ClipboardList, CalendarClock } from "lucide-react";

// Bloco de indicadores do painel: números da base inteira (administradores) ou
// apenas os do próprio coach.
export default function Indicadores({ titulo, subtitulo, m }) {
  return (
    <section>
      {(titulo || subtitulo) && (
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          {titulo && (
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h2>
          )}
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={Users} label="Clientes" value={m.clientes} to="/clientes" hint={`${m.ativos} ativo(s)`} />
        <KpiCard icon={Activity} label="Avaliações no mês" value={m.avaliacoesMes} tone="sky" hint="Registradas neste mês" />
        <KpiCard icon={ClipboardList} label="Anamneses pendentes" value={m.pendentes} tone="amber" to="/anamnese" hint="Aguardando resposta" />
        <KpiCard icon={CalendarClock} label="Atendimentos hoje" value={m.hoje} tone="rose" to="/agenda" hint={`${m.semana} nos próximos 7 dias`} />
      </div>
    </section>
  );
}