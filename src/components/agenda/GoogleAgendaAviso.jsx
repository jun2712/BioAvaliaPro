import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { statusGoogleCalendar } from "@/lib/googleAgenda";
import SincronizarFuturosDialog from "@/components/conta/SincronizarFuturosDialog";

// Aviso sobre a agenda Google compartilhada: informa quando a integração está
// inativa e permite enviar os agendamentos futuros do próprio Coach.
export default function GoogleAgendaAviso({ onMudou }) {
  const [status, setStatus] = useState(null);
  const [confirmar, setConfirmar] = useState(false);

  const carregar = async () => {
    const s = await statusGoogleCalendar();
    setStatus(s);
    onMudou?.();
    return s;
  };

  useEffect(() => {
    carregar();
  }, []);

  if (!status) return null;
  const semEvento = status.futuros_sem_evento || 0;
  if (status.conectado && semEvento === 0) return null;

  return (
    <>
      <Card className={`p-4 mb-6 max-w-3xl ${status.conectado ? "border-amber-300 bg-amber-50" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${status.conectado ? "text-amber-600" : "text-destructive"}`} />
            <div>
              <p className="text-sm font-medium">
                {status.conectado
                  ? `${semEvento} agendamento${semEvento === 1 ? "" : "s"} futuro${semEvento === 1 ? "" : "s"} sem evento no Google`
                  : "Agenda Google compartilhada não conectada"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.conectado
                  ? "Envie para o calendário compartilhado para manter as duas agendas iguais."
                  : "Os agendamentos continuam salvos no app, mas não são criados no calendário. Fale com o administrador para ativar a integração."}
              </p>
            </div>
          </div>
          {status.conectado && (
            <Button size="sm" onClick={() => setConfirmar(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Enviar ao Google
            </Button>
          )}
        </div>
      </Card>

      <SincronizarFuturosDialog
        open={confirmar}
        quantidade={semEvento}
        onClose={() => setConfirmar(false)}
        onFeito={() => carregar()}
      />
    </>
  );
}