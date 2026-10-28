import React, { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Pop-up explicativo que permanece visível: abre ao passar o cursor (ou tocar)
// no ícone e só fecha quando o cursor sai do ícone E do texto, ao clicar fora
// ou com a tecla Esc.
export default function InfoTooltip({ texto }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const anchorRef = useRef(null);

  const abrir = () => {
    clearTimeout(timerRef.current);
    setOpen(true);
  };
  const fecharComAtraso = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 250);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const alvo = e.target;
      if (anchorRef.current?.contains(alvo) || alvo.closest?.("[data-info-popup]")) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!texto) return null;

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={400}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <span
            ref={anchorRef}
            className="inline-flex cursor-help text-muted-foreground hover:text-primary"
            tabIndex={0}
            onPointerEnter={abrir}
            onPointerLeave={fecharComAtraso}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            onFocus={abrir}
          >
            <Info className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          data-info-popup=""
          side="top"
          className="max-w-[240px] text-xs leading-relaxed pointer-events-auto"
          onPointerEnter={abrir}
          onPointerLeave={fecharComAtraso}
        >
          {texto}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}