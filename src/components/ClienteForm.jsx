import React, { useState, useEffect } from "react";
import { db } from "@/api/dataClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import GrupoCombobox from "@/components/GrupoCombobox";
import WhatsAppInput from "@/components/WhatsAppInput";
import { codigoUnico } from "@/lib/clienteCodigo";
import { STATUS_CLIENTE } from "@/lib/fluxo";
import { dataHojeLocal } from "@/lib/datas";

const empty = { nome: "", email: "", notas: "", whatsapp: "", data_nascimento: "", sexo: "Feminino", altura: "", grupo: "", status: "ativo", objetivo: "", data_inicio: "" };

export default function ClienteForm({ open, onClose, onSaved, cliente = null, clientes = [] }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(cliente ? { ...empty, ...cliente, altura: cliente.altura ?? "" } : empty);
    }
  }, [open, cliente]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      email: form.email?.trim() || null,
      notas: form.notas?.trim() || null,
      whatsapp: form.whatsapp?.trim() || null,
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo,
      altura: form.altura ? Number(form.altura) : null,
      grupo: form.grupo?.trim() || null,
      status: form.status || "ativo",
      objetivo: form.objetivo?.trim() || null,
      data_inicio: form.data_inicio || (cliente ? null : dataHojeLocal()),
    };
    try {
      if (cliente) {
        await db.entities.Cliente.update(cliente.id, payload);
      } else {
        const user = await db.auth.me().catch(() => null);
        const coach = user?.coach_nome || user?.email || null;
        await db.entities.Cliente.create({ ...payload, codigo: await codigoUnico(), coach });
      }
      onSaved?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          {cliente?.codigo && <p className="text-sm text-muted-foreground -mt-1">ID: {cliente.codigo}</p>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required placeholder="Nome do cliente" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <WhatsAppInput value={form.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => set("sexo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Altura (cm)</Label>
              <Input type="number" step="1" min="100" max="250" inputMode="numeric" value={form.altura}
                onChange={(e) => set("altura", e.target.value)} placeholder="Ex: 172" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || "ativo"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_CLIENTE.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo principal</Label>
              <Input value={form.objetivo || ""} onChange={(e) => set("objetivo", e.target.value)} placeholder="Ex: emagrecimento" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Início do acompanhamento</Label>
            <Input type="date" value={form.data_inicio || ""} onChange={(e) => set("data_inicio", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <GrupoCombobox value={form.grupo || ""} onChange={(v) => set("grupo", v)} />
            <p className="text-xs text-muted-foreground">Escolha um grupo existente ou crie um novo digitando o nome.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notas || ""} onChange={(e) => set("notas", e.target.value)}
              placeholder="Observações que aparecem no perfil do cliente." />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {cliente ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}