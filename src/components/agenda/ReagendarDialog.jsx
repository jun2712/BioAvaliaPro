import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { formatarDataBR } from "@/lib/datas";

// Reagendamento de um atendimento: altera data e hora no app e no Google Calendar.
export default function ReagendarDialog({ open, onClose, agendamento, onSaved }) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (open && agendamento) {
      setData(agendamento.data || "");
      setHora(agendamento.hora || "09:00");
      setAviso("");
    }
  }, [open, agendamento]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setAviso("");
    try {
      const res = await base44.functions.invoke("reagendarEventoGoogle", {
        agendamento_id: agendamento.id,
        data,
        hora,
      });
      onSaved?.();
      if (res.data?.aviso) {
        setAviso(`Novo horário salvo no app, mas o Google Calendar não foi atualizado: ${res.data.aviso}`);
      } else if (res.data?.vinculado === false) {
        setAviso(
          "Novo horário salvo no app. A agenda Google compartilhada não está conectada, então o evento no Google Calendar não foi alterado — peça ao administrador para ativá-la."
        );
      } else {
        onClose?.();
      }
    } catch (err) {
      setAviso(err?.response?.data?.error || "Não foi possível reagendar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar</DialogTitle>
          <DialogDescription>
            {agendamento?.nome}
            {agendamento?.data
              ? ` · hoje em ${formatarDataBR(agendamento.data)}${agendamento.hora ? ` às ${agendamento.hora}` : ""}`
              : ""}
            . A alteração vai para o Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nova data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nova hora *</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
            </div>
          </div>
          {aviso && (
            <p className="text-sm text-destructive flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{aviso}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reagendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}