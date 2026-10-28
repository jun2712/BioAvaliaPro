import { useEffect, useState } from "react";
import { db } from "@/api/dataClient";
import { MEDIDAS_PERIOMETRIA } from "@/lib/medidas";

const TODAS = MEDIDAS_PERIOMETRIA.map((m) => m.name);

// Medidas ativas do profissional (Configurações). null enquanto carrega;
// sem preferência salva (ou sem login, ex.: relatório público) usa todas.
export default function useMedidasAtivas() {
  const [medidas, setMedidas] = useState(null);

  useEffect(() => {
    let ativo = true;
    db.auth.me()
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