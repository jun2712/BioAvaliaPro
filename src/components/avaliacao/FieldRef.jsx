import React from "react";
import { LABEL_COLOR } from "@/lib/bioRefs";

export default function FieldRef({ info }) {
  if (!info) return null;
  const color = LABEL_COLOR[info.label] || "text-muted-foreground bg-muted border-border";
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5">
      {info.label && info.label !== "—" && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
          {info.label}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground">{info.referencia}</span>
    </div>
  );
}