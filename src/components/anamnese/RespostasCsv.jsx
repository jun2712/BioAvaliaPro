import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, FileUp, Loader2 } from "lucide-react";
import { lerTextoCSV } from "@/lib/csv";
import { baixarRespostasCSV, importarRespostasCSV } from "@/lib/anamneseCsv";

// Exportação e importação das respostas de anamnese em CSV (planilha).
export default function RespostasCsv({ onImported }) {
  const [open, setOpen] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resumo, setResumo] = useState("");
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);

  const exportar = async () => {
    setErro("");
    setResumo("");
    setOcupado(true);
    try {
      const r = await baixarRespostasCSV();
      setResumo(`${r.linhas} resposta(s) de ${r.anamneses} anamnese(s) exportadas.`);
    } catch (e) {
      setErro(e?.message || "Não foi possível exportar as respostas.");
    } finally {
      setOcupado(false);
    }
  };

  const importar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro("");
    setResumo("");
    setOcupado(true);
    try {
      const texto = await lerTextoCSV(file);
      const r = await importarRespostasCSV(texto);
      setResumo(`${r.atualizadas} anamnese(s) atualizada(s) · ${r.respostas} resposta(s) importada(s) · ${r.ignoradas} linha(s) ignorada(s).`);
      onImported?.();
    } catch (err) {
      setErro(err?.message || "Não foi possível importar o arquivo.");
    } finally {
      setOcupado(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} title="Respostas em CSV">
        <FileDown className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Respostas CSV</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Respostas em CSV</DialogTitle>
            <DialogDescription>
              Exporte todas as respostas em planilha e importe de volta para restaurar ou atualizar.
              Cada linha traz o token da anamnese e o código da pergunta, então as respostas voltam sempre
              para a pergunta certa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border p-4">
              <p className="font-medium text-sm">Exportar</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Gera um arquivo com todas as anamneses e suas respostas (uma linha por pergunta).
              </p>
              <Button onClick={exportar} disabled={ocupado}>
                {ocupado ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                Baixar CSV
              </Button>
            </div>

            <div className="rounded-xl border p-4">
              <p className="font-medium text-sm">Importar</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Selecione o CSV exportado. As respostas são gravadas na anamnese e na pergunta indicadas
                pelas colunas "Token da anamnese" e "Código da pergunta".
              </p>
              <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={importar} disabled={ocupado} className="hidden" />
              <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={ocupado}>
                <FileUp className="w-4 h-4 mr-2" />Escolher arquivo
              </Button>
            </div>

            {resumo && <p className="text-sm text-primary">{resumo}</p>}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}