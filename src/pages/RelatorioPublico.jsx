import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ReportContent from "@/components/ReportContent";
import { Card } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";

export default function RelatorioPublico() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    base44.functions
      .invoke("getPublicReport", { token })
      .then((res) => { if (ativo) setDados(res.data); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [token]);

  if (erro) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
        <Card className="max-w-md p-10 text-center">
          <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Relatório indisponível</p>
          <p className="text-sm text-muted-foreground mt-1">O link é inválido ou o relatório não está mais disponível. Fale com o seu profissional.</p>
        </Card>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-muted/30 flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { cliente, avaliacoes } = dados;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Relatório de Avaliação Física</h1>
          <p className="text-sm text-muted-foreground">{cliente.nome}</p>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {avaliacoes.length ? (
          <>
            <ReportContent cliente={cliente} avaliacoes={avaliacoes} medidasExternas={dados.medidas_ativas} mostrarNavy={dados.mostrar_navy !== false} metaProteica={cliente.meta_proteica} />
            <p className="text-xs text-muted-foreground mt-8">Relatório compartilhado pelo profissional · somente leitura</p>
          </>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Nenhuma avaliação registrada</p>
          </Card>
        )}
      </main>
    </div>
  );
}