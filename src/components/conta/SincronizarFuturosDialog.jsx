import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2, AlertCircle } from "lucide-react";

// Confirmação antes de enviar ao Google Calendar os agendamentos futuros já existentes
export default function SincronizarFuturosDialog({ open, quantidade = 0, onClose, onFeito }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const res = await base44.functions.invoke("sincronizarFuturosGoogle", {});
      setResultado(res.data || {});
      onFeito?.();
    } catch (err) {
      setErro(err?.response?.data?.error || "Não foi possível enviar os agendamentos agora.");
    } finally {
      setEnviando(false);
    }
  };

  const fechar = () => {
    setResultado(null);
    setErro("");
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sincronizar agendamentos futuros?</DialogTitle>
          <DialogDescription>
            {resultado
              ? "Agendamentos enviados à agenda Google compartilhada."
              : `Existem ${quantidade} agendamento${quantidade === 1 ? "" : "s"} futuro${quantidade === 1 ? "" : "s"} que ainda não está${quantidade === 1 ? "" : "m"} no Google Calendar. Deseja criar os eventos agora?`}
          </DialogDescription>
        </DialogHeader>

        {resultado && (
          <p className="text-sm">
            {resultado.criados || 0} evento(s) criado(s)
            {resultado.falhas ? ` · ${resultado.falhas} não puderam ser criados` : ""}.
          </p>
        )}
        {erro && (
          <p className="text-sm text-destructive flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{erro}
          </p>
        )}

        <DialogFooter>
          {resultado ? (
            <Button onClick={fechar}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={fechar} disabled={enviando}>Agora não</Button>
              <Button onClick={enviar} disabled={enviando || quantidade === 0}>
                {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                Sincronizar agora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}