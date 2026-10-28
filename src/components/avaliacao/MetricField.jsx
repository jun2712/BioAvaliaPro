import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FieldRef from "./FieldRef";
import InfoTooltip from "@/components/InfoTooltip";

export default function MetricField({ label, name, value, onChange, info, explicacao, suffix, readOnly, step = "0.1", placeholder }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <span className="cursor-default">{label}{suffix && <span className="text-muted-foreground/70"> · {suffix}</span>}</span>
        {explicacao && <InfoTooltip texto={explicacao} />}
      </Label>
      <Input
        type="number"
        step={step}
        inputMode="decimal"
        value={value ?? ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value === "" ? null : Number(e.target.value))}
        className={`h-10 ${readOnly ? "bg-muted/60 font-medium" : ""}`}
      />
      {info && <FieldRef info={info} />}
    </div>
  );
}