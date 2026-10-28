import React from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function MappingTable({ headers, rows, fields, mapping, onMappingChange }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((h, idx) => (
              <th key={idx} className="p-2 text-left align-top border-b min-w-[160px]">
                <div className="font-medium truncate" title={h}>{h || "(sem nome)"}</div>
                <Select value={mapping[idx] || "__ignore"} onValueChange={(v) => onMappingChange(idx, v)}>
                  <SelectTrigger className="mt-1 h-8 w-full">
                    <SelectValue placeholder="Ignorar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ignore">Ignorar</SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}{f.required ? " *" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 3).map((linha, li) => (
            <tr key={li} className="border-b last:border-0">
              {headers.map((_, idx) => (
                <td key={idx} className="p-2 max-w-[200px] truncate" title={linha[idx]}>{linha[idx]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}