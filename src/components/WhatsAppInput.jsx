import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

// Campo de WhatsApp com código do país (padrão +55, alterável).
// O valor salvo contém o código + número, apenas dígitos (ex.: 5511999999999).
export default function WhatsAppInput({ value, onChange, placeholder = "(11) 99999-9999" }) {
  const [pais, setPais] = useState("55");
  const [numero, setNumero] = useState("");
  const ultimoValor = useRef(null);

  // Sincroniza quando o valor externo muda (ex.: abrir o formulário para outro cliente)
  useEffect(() => {
    if (value === ultimoValor.current) return;
    const d = String(value ?? "").replace(/\D/g, "");
    if (d.length >= 12 && d.startsWith("55")) {
      setPais(d.slice(0, 2));
      setNumero(d.slice(2));
    } else {
      setPais("55");
      setNumero(d);
    }
    ultimoValor.current = value;
  }, [value]);

  const emitir = (novoPais, novoNumero) => {
    const p = String(novoPais ?? "").replace(/\D/g, "").slice(0, 3);
    const n = String(novoNumero ?? "").replace(/\D/g, "");
    setPais(p);
    setNumero(n);
    const cheio = p + n;
    ultimoValor.current = cheio;
    onChange?.(cheio || "");
  };

  return (
    <div className="flex gap-2">
      <div className="flex items-center border border-input rounded-md px-2 bg-muted/40 w-[72px] shrink-0">
        <span className="text-sm text-muted-foreground">+</span>
        <input
          value={pais}
          onChange={(e) => emitir(e.target.value, numero)}
          inputMode="numeric"
          aria-label="Código do país"
          className="w-full bg-transparent text-sm py-2 outline-none"
        />
      </div>
      <Input
        className="flex-1"
        value={numero}
        onChange={(e) => emitir(pais, e.target.value)}
        placeholder={placeholder}
        inputMode="tel"
      />
    </div>
  );
}