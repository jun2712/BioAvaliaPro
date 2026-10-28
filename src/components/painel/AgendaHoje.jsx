import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CalendarClock, MessageCircle, ChevronRight } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";

const enviarConfirmacao = (item) => {
  const primeiro = (item.nome || "cliente").split(" ")[0];
  const quando = item.hora ? ` hoje às ${item.hora}` : " hoje";
  const msg = encodeURIComponent(`Olá, ${primeiro}! Passando para confirmar seu atendimento${quando}. Tudo certo?`);
  window.open(linkWhatsApp(item.whatsapp, msg), "_blank");
};

// Atendimentos do dia, em ordem de horário, com confirmação por WhatsApp.
export default function AgendaHoje({ itens = [], totalSemana = 0 }) {
  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="font-heading font-semibold text-lg leading-none">Atendimentos de hoje</h2>
          <p className="text-xs text-muted-foreground mt-1.5">
            {itens.length === 0
              ? "Nenhum horário marcado"
              : `${itens.length} ${itens.length === 1 ? "atendimento" : "atendimentos"} na agenda`}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/agenda">Agenda<ChevronRight className="w-4 h-4 ml-1" /></Link>
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-dashed py-10 text-center">
          <CalendarClock className="w-7 h-7 mx-auto text-muted-foreground/70" />
          <p className="mt-3 font-medium text-sm">Dia livre</p>
          <p className="text-xs text-muted-foreground mt-1">Os atendimentos marcados para hoje aparecem aqui.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <span className="font-mono text-sm text-muted-foreground w-12 shrink-0">{item.hora || "--:--"}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <Link to={`/cliente/${item.cliente_id}`} className="font-medium truncate block hover:underline">
                  {item.nome}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{item.tipoLabel}</p>
              </div>
              {item.whatsapp && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Confirmar por WhatsApp"
                  onClick={() => enviarConfirmacao(item)}>
                  <MessageCircle className="w-4 h-4" />
                </Button>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            </li>
          ))}
        </ul>
      )}

      {totalSemana > itens.length && (
        <p className="px-5 py-3 text-xs text-muted-foreground border-t bg-muted/30">
          +{totalSemana - itens.length} atendimento(s) nos próximos 7 dias
        </p>
      )}
    </section>
  );
}