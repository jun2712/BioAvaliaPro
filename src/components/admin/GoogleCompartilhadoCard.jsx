import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CalendarCheck, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { statusGoogleCalendar } from "@/lib/googleAgenda";
import SincronizarFuturosDialog from "@/components/conta/SincronizarFuturosDialog";

// Agenda Google compartilhada: uma única conta atende todos os Coaches. O vínculo é
// autorizado pelo proprietário do app, uma vez, na construção; aqui o administrador
// acompanha o estado e envia os agendamentos futuros.
export default function GoogleCompartilhadoCard() {
  const [status, setStatus] = useState(null);
  const [confirmar, setConfirmar] = useState(false);

  const carregar = async () => setStatus(await statusGoogleCalendar());

  useEffect(() => {
    carregar();
  }, []);

  const semEvento = status?.futuros_sem_evento || 0;

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Agenda Google compartilhada</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
          Uma única conta Google atende todos os Coaches. O proprietário do app autoriza essa conta
          uma vez, no painel de construção do app; a partir daí, os agendamentos de todos os Coaches
          são criados nesse mesmo calendário — nenhum Coach precisa fazer login no Google.
        </p>

        {status == null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Verificando a conexão...
          </div>
        ) : status.conectado ? (
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Conectada{status.email ? ` · ${status.email}` : ""}
            </span>
            {semEvento > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-amber-700">
                  {semEvento} agendamento{semEvento === 1 ? "" : "s"} futuro
                  {semEvento === 1 ? "" : "s"} sem evento no Google.
                </p>
                <Button size="sm" onClick={() => setConfirmar(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Enviar ao Google
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 max-w-2xl">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              Nenhuma conta Google está conectada. Para ativar, o proprietário do app precisa
              autorizar a conta Google uma única vez no painel de construção do app. Até lá, os
              agendamentos continuam salvos no app, mas não são criados no Google Calendar.
            </p>
          </div>
        )}
      </Card>

      <SincronizarFuturosDialog
        open={confirmar}
        quantidade={semEvento}
        onClose={() => setConfirmar(false)}
        onFeito={carregar}
      />
    </>
  );
}