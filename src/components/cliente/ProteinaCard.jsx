import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Beef, Loader2, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "@/lib/whatsapp";
import { formatarDataBR } from "@/lib/datas";
import {
  novoToken,
  formatarFator,
  faixaRefeicao,
  rotuloOpcao,
  NIVEL_ATIVIDADE,
  OBJETIVO,
  SEXO,
} from "@/lib/proteina";

// Envio do formulário público de meta proteica pelo WhatsApp e consulta do resultado.
export default function ProteinaCard({ cliente }) {
  const [registro, setRegistro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    base44.entities.CalculoProteina
      .filter({ cliente_id: cliente.id }, { sort: "-created_date", limit: 1 })
      .then((pagina) => { if (ativo) setRegistro(pagina.items?.[0] || null); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [cliente.id]);

  const enviarFormulario = async () => {
    if (enviando) return;
    setEnviando(true);
    // Abre a aba de forma síncrona: o navegador bloqueia popups abertos depois de um await
    const win = window.open("", "_blank");
    try {
      let atual = registro;
      if (!atual) {
        atual = await base44.entities.CalculoProteina.create({
          cliente_id: cliente.id,
          nome: cliente.nome,
          whatsapp: cliente.whatsapp || null,
          token: novoToken(),
          status: "pendente",
        });
        setRegistro(atual);
      }
      const link = `${window.location.origin}/proteina/${atual.token}`;
      const msg = encodeURIComponent(
        `Olá, ${cliente.nome.split(" ")[0]}! Para calcular a sua meta diária de proteína, responda este formulário: ${link}`
      );
      const url = linkWhatsApp(cliente.whatsapp, msg);
      if (win) win.location.replace(url);
      else window.location.href = url;
    } catch (err) {
      if (win) win.close();
      throw err;
    } finally {
      setEnviando(false);
    }
  };

  // A ficha do cliente guarda a meta mais recente (vinda da anamnese ou deste formulário)
  const resultado =
    cliente.meta_proteica?.gramas_dia != null
      ? cliente.meta_proteica
      : registro?.status === "respondida"
        ? registro
        : null;
  const respondido = !!resultado;
  const dataResultado = resultado?.respondida_em || resultado?.calculado_em;

  return (
    <Card className="p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Beef className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Meta proteica</h3>
        </div>
        <Button size="sm" variant={respondido ? "outline" : "default"} onClick={enviarFormulario} disabled={enviando}>
          {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
          {registro ? "Reenviar pelo WhatsApp" : "Enviar formulário pelo WhatsApp"}
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : respondido ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta diária</p>
              <p className="text-lg font-semibold mt-0.5">{resultado.gramas_dia} g</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fator</p>
              <p className="text-lg font-semibold mt-0.5">{formatarFator(resultado.fator)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Por refeição</p>
              <p className="text-lg font-semibold mt-0.5">{faixaRefeicao(resultado)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Refeições</p>
              <p className="text-lg font-semibold mt-0.5">{resultado.refeicoes ?? "—"}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {resultado.peso != null ? `${resultado.peso} kg` : "—"}
            {resultado.idade != null ? ` · ${resultado.idade} anos` : ""}
            {resultado.sexo ? ` · ${rotuloOpcao(SEXO, resultado.sexo)}` : ""}
            {resultado.nivel_atividade ? ` · ${rotuloOpcao(NIVEL_ATIVIDADE, resultado.nivel_atividade)}` : ""}
            {resultado.objetivo ? ` · ${rotuloOpcao(OBJETIVO, resultado.objetivo)}` : ""}
            {resultado.usa_glp1 ? " · usa GLP-1" : ""}
          </p>
          {dataResultado && (
            <p className="text-xs text-muted-foreground mt-1">
              Respondido em {formatarDataBR(dataResultado)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground mt-3">
          {registro
            ? "Formulário enviado — aguardando a resposta do cliente."
            : "Envie o link para o cliente informar peso, idade, altura, rotina de treino e objetivo. O cálculo fica salvo no perfil."}
        </p>
      )}
    </Card>
  );
}