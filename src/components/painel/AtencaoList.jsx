import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";
import { formatarDataBR } from "@/lib/datas";

const TONS = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

const detalhe = (item) => {
  if (!item.ultima) return "Nunca avaliado";
  const quando = `Última avaliação ${formatarDataBR(item.ultima.data)}`;
  if (item.motivo === "Sem avaliação recente") return `${quando} · ${item.dias} dias`;
  return quando;
};

const chamar = (item) => {
  const primeiro = (item.cliente.nome || "cliente").split(" ")[0];
  const msg = encodeURIComponent(`Olá, ${primeiro}! Vamos marcar sua próxima avaliação?`);
  window.open(linkWhatsApp(item.cliente.whatsapp, msg), "_blank");
};

// Acompanhamentos que pedem ação: retorno vencido, sem avaliação recente ou nunca avaliado.
export default function AtencaoList({ itens = [], total = 0 }) {
  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="font-heading font-semibold text-lg leading-none">Precisa de atenção</h2>
          <p className="text-xs text-muted-foreground mt-1.5">
            {total === 0 ? "Todos os acompanhamentos em dia" : `${total} acompanhamento(s) pedindo ação`}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/clientes">Clientes</Link>
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-dashed py-10 text-center">
          <CheckCircle2 className="w-7 h-7 mx-auto text-primary" />
          <p className="mt-3 font-medium text-sm">Nada pendente</p>
          <p className="text-xs text-muted-foreground mt-1">Retornos vencidos e clientes sem avaliação aparecem aqui.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <li key={item.cliente.id} className="flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/cliente/${item.cliente.id}`} className="font-medium truncate hover:underline">
                    {item.cliente.nome}
                  </Link>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${TONS[item.tom]}`}>
                    {item.motivo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{detalhe(item)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.cliente.whatsapp && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Chamar no WhatsApp" onClick={() => chamar(item)}>
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link to={`/avaliacao/nova/${item.cliente.id}`}>
                    Avaliar<ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}