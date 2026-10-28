import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const TONS = {
  primary: "bg-primary/20 text-primary-foreground",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
};

// Indicador numérico do painel: rótulo curto, número grande e uma dica opcional.
export default function KpiCard({ icon: Icon, label, value, hint, to, tone = "primary" }) {
  const corpo = (
    <div className="h-full rounded-2xl border bg-card p-4 sm:p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", TONS[tone])}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <p className="font-heading text-3xl font-semibold tracking-tight leading-none">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );

  if (!to) return corpo;
  return (
    <Link to={to} className="block h-full">
      {corpo}
    </Link>
  );
}