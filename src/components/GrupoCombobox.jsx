import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";

// Campo de grupo com sugestões: escolhe um grupo existente ou digita um novo.
export default function GrupoCombobox({ value, onChange }) {
  const [grupos, setGrupos] = useState([]);

  useEffect(() => {
    let ativo = true;
    base44.entities.Cliente.list("-updated_date", 500)
      .then((lista) => {
        if (!ativo) return;
        const unicos = [...new Set(lista.map((c) => (c.grupo || "").trim()).filter(Boolean))];
        setGrupos(unicos.sort());
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  return (
    <>
      <Input
        list="grupos-clientes"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: Clientes do Espaço"
      />
      <datalist id="grupos-clientes">
        {grupos.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </>
  );
}