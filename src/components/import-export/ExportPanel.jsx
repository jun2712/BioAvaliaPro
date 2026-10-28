import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, Users, Activity, ClipboardList, ListOrdered } from "lucide-react";
import { AVALIACAO_FIELDS, downloadCSV } from "@/lib/csv";
import { carregarTudo } from "@/lib/carregarTudo";
import { formatarDataBR } from "@/lib/datas";
import { STATUS_CLIENTE } from "@/lib/fluxo";
import { PERGUNTAS_ANAMNESE } from "@/lib/anamneseBank";
import { useToast } from "@/components/ui/use-toast";

// Colunas do cadastro do cliente (a próxima avaliação não faz parte do cadastro)
const COLUNAS_CLIENTES = [
  "ID do cliente", "Nome completo", "E-mail", "Notas do cliente", "WhatsApp",
  "Data de nascimento", "Sexo", "Altura (cm)", "Status", "Objetivo principal",
  "Início do acompanhamento", "Grupo", "Coach",
];

// Colunas fixas da tabela de anamneses; em seguida vem uma coluna por código de pergunta
const COLUNAS_ANAMNESE = [
  "ID do cliente", "Nome do Cliente", "Data da anamnese", "WhatsApp", "Status", "Data da Resposta",
];

const COLUNAS_PERGUNTAS = ["Código da pergunta", "Pergunta", "Categoria"];

const dataBR = (v) => (v ? formatarDataBR(String(v).slice(0, 10)) : "");
const statusLabel = (v) =>
  STATUS_CLIENTE.find((s) => s.value === (v || "ativo"))?.label || v || "";

// Código da pergunta sempre com 3 dígitos (101, 003, 419), como no catálogo
const codigoPergunta = (v) => {
  const c = String(v ?? "").trim();
  return /^\d+$/.test(c) ? c.padStart(3, "0") : c;
};
const compararCodigo = (a, b) => a.localeCompare(b, "pt-BR", { numeric: true });

// Exportação por tipo de dado: clientes, avaliações e anamneses.
export default function ExportPanel() {
  const { toast } = useToast();
  const [exportando, setExportando] = useState("");

  const exportar = async (tipo) => {
    if (exportando) return;
    setExportando(tipo);
    try {
      const clientes = await carregarTudo("Cliente");
      if (tipo === "clientes") {
        if (!clientes.length) {
          toast({ title: "Nada para exportar", description: "Nenhum cliente está registrado no app." });
          return;
        }
        downloadCSV("clientes.csv", COLUNAS_CLIENTES, clientes.map((c) => ({
          "ID do cliente": c.codigo ?? "",
          "Nome completo": c.nome ?? "",
          "E-mail": c.email ?? "",
          "Notas do cliente": c.notas ?? "",
          "WhatsApp": c.whatsapp ?? "",
          "Data de nascimento": dataBR(c.data_nascimento),
          "Sexo": c.sexo ?? "",
          "Altura (cm)": c.altura ?? "",
          "Status": statusLabel(c.status),
          "Objetivo principal": c.objetivo ?? "",
          "Início do acompanhamento": dataBR(c.data_inicio),
          "Grupo": c.grupo ?? "",
          "Coach": c.coach ?? "",
        })));
      } else if (tipo === "avaliacoes") {
        const avaliacoes = await carregarTudo("Avaliacao");
        if (!avaliacoes.length) {
          toast({ title: "Nada para exportar", description: "Nenhuma avaliação está registrada no app." });
          return;
        }
        const clientePorId = new Map(clientes.map((c) => [c.id, c]));
        const campos = AVALIACAO_FIELDS.filter((f) => !f.key.startsWith("_"));
        const colunas = ["ID do cliente", "Cliente", ...campos.map((f) => f.label)];
        downloadCSV("avaliacoes.csv", colunas, avaliacoes.map((a) => {
          const cli = clientePorId.get(a.cliente_id);
          const linha = {
            "ID do cliente": cli?.codigo ?? "",
            "Cliente": cli?.nome ?? "",
          };
          campos.forEach((f) => {
            // Altura: a registrada na própria avaliação; avaliações antigas usam a do cadastro
            linha[f.label] = f.key === "altura" ? (a.altura ?? cli?.altura ?? "") : (a[f.key] ?? "");
          });
          return linha;
        }));
      } else {
        const anamneses = await carregarTudo("Anamnese");
        if (tipo === "anamneses") {
          if (!anamneses.length) {
            toast({ title: "Nada para exportar", description: "Nenhuma anamnese está registrada no app." });
            return;
          }
          const clientePorId = new Map(clientes.map((c) => [c.id, c]));
          // Uma coluna para cada código de pergunta presente nas anamneses exportadas
          const codigos = new Set();
          anamneses.forEach((a) => (a.perguntas || []).forEach((p) => {
            const codigo = codigoPergunta(p.codigo);
            if (codigo) codigos.add(codigo);
          }));
          const colunasCodigos = [...codigos].sort(compararCodigo);
          const colunas = [...COLUNAS_ANAMNESE, ...colunasCodigos];
          // Uma linha por anamnese, com cada resposta na coluna do seu código
          const linhas = anamneses.map((a) => {
            const cli = clientePorId.get(a.cliente_id);
            const linha = {
              "ID do cliente": cli?.codigo ?? "",
              "Nome do Cliente": a.nome || cli?.nome || "",
              "Data da anamnese": dataBR(a.data),
              "WhatsApp": a.whatsapp ?? "",
              "Status": a.status ?? "",
              "Data da Resposta": a.respondida_em ? dataBR(a.respondida_em) : "",
            };
            (a.perguntas || []).forEach((p) => {
              const codigo = codigoPergunta(p.codigo);
              if (codigo) linha[codigo] = p.resposta ?? "";
            });
            return linha;
          });
          downloadCSV("anamneses.csv", colunas, linhas);
        } else {
          // Todos os códigos catalogados e suas perguntas (+ códigos avulsos das anamneses)
          const catalogo = new Map(PERGUNTAS_ANAMNESE.map((p) => [codigoPergunta(p.codigo), p]));
          anamneses.forEach((a) => (a.perguntas || []).forEach((p) => {
            const codigo = codigoPergunta(p.codigo);
            if (codigo && !catalogo.has(codigo)) catalogo.set(codigo, p);
          }));
          const linhas = [...catalogo.entries()]
            .sort((a, b) => compararCodigo(a[0], b[0]))
            .map(([codigo, p]) => ({
              "Código da pergunta": codigo,
              "Pergunta": p.pergunta ?? "",
              "Categoria": p.categoria ?? "",
            }));
          downloadCSV("codigos-das-perguntas.csv", COLUNAS_PERGUNTAS, linhas);
        }
      }
    } finally {
      setExportando("");
    }
  };

  const botao = (tipo, icone, titulo, descricao, nomeArquivo) => (
    <Card className="p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {icone}
        <div>
          <p className="font-medium">{titulo}</p>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <Button variant="outline" onClick={() => exportar(tipo)} disabled={exportando !== ""}>
        {exportando === tipo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        {nomeArquivo}
      </Button>
    </Card>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Os arquivos usam ";" como separador de colunas e datas em dd/mm/aaaa, e são compatíveis com o Excel em português.
      </p>
      {botao(
        "clientes",
        <Users className="w-5 h-5 text-muted-foreground mt-0.5" />,
        "Clientes",
        "ID, nome, e-mail, notas, WhatsApp, nascimento, sexo, altura (cm), status, objetivo, início do acompanhamento, grupo e coach.",
        "clientes.csv"
      )}
      {botao(
        "avaliacoes",
        <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />,
        "Avaliações",
        "Todas as avaliações com ID do cliente, altura, bioimpedância, medidas (incluindo pescoço, antebraços e fêmur) e notas.",
        "avaliacoes.csv"
      )}
      {botao(
        "anamneses",
        <ClipboardList className="w-5 h-5 text-muted-foreground mt-0.5" />,
        "Anamneses + respostas",
        "Uma linha por anamnese: dados do cliente e uma coluna para cada código de pergunta, com a resposta.",
        "anamneses.csv"
      )}
      {botao(
        "perguntas",
        <ListOrdered className="w-5 h-5 text-muted-foreground mt-0.5" />,
        "Códigos das perguntas",
        "Todos os códigos catalogados com o texto de cada pergunta disponível para a anamnese.",
        "codigos-das-perguntas.csv"
      )}
    </div>
  );
}