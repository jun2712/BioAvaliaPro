import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClipboardList, MessageCircle, Link2, Check, ChevronRight } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";

const linkDa = (a) => `${window.location.origin}/responder/${a.token}`;

const enviar = (a) => {
  const primeiro = (a.nome || "cliente").split(" ")[0];
  const msg = encodeURIComponent(`Olá, ${primeiro}! Segue o link para você preencher sua anamnese: ${linkDa(a)}`);
  window.open(linkWhatsApp(a.whatsapp, msg), "_blank");
};

// Anamneses ainda não respondidas: o profissional age direto do painel.
export default function AnamnesesPendentes({ itens = [], total = 0 }) {
  const [copiado, setCopiado] = useState(null);

  const copiar = async (a) => {
    try {
      await navigator.clipboard.writeText(linkDa(a));
      setCopiado(a.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt("Copie o link da anamnese:", linkDa(a));
    }
  };

  return (
    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="font-heading font-semibold text-lg leading-none">Anamneses pendentes</h2>
          <p className="text-xs text-muted-foreground mt-1.5">
            {total === 0 ? "Nenhuma aguardando resposta" : `${total} aguardando resposta`}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/anamnese">Ver todas<ChevronRight className="w-4 h-4 ml-1" /></Link>
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-dashed py-10 text-center">
          <ClipboardList className="w-7 h-7 mx-auto text-muted-foreground/70" />
          <p className="mt-3 font-medium text-sm">Tudo respondido</p>
          <p className="text-xs text-muted-foreground mt-1">Envie um novo questionário pelo módulo Anamnese.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((a) => (
            <li key={a.id} className="px-5 py-3">
              <p className="font-medium truncate text-sm">{a.nome || "Prospecto"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enviada em {new Date(a.created_date).toLocaleDateString("pt-BR")}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => enviar(a)}>
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />WhatsApp
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => copiar(a)}>
                  {copiado === a.id ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                  {copiado === a.id ? "Copiado" : "Link"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}