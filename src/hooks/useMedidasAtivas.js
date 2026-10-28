import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MEDIDAS_PERIOMETRIA } from "@/lib/medidas";

const TODAS = MEDIDAS_PERIOMETRIA.map((m) => m.name);

// Medidas ativas do profissional (Configurações). null enquanto carrega;
// sem preferência salva (ou sem login, ex.: relatório público) usa todas.
export default function useMedidasAtivas() {
  const [medidas, setMedidas] = useState(null);

  useEffect(() => {
    let ativo = true;
    base44.auth.me()
      .then((u) => {
        if (!ativo) return;
        const salvas = Array.isArray(u?.medidas_ativas) && u.medidas_ativas.length ? u.medidas_ativas : null;
        setMedidas(salvas ?? TODAS);
      })
      .catch(() => { if (ativo) setMedidas(TODAS); });
    return () => { ativo = false; };
  }, []);

  return medidas;
}