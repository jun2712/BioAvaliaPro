import React from "react";

// Bloco de uma cláusula nas páginas legais.
export default function Secao({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold text-foreground">{titulo}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground space-y-2 [&_li]:ml-5 [&_li]:list-disc marker:text-primary">
        {children}
      </div>
    </section>
  );
}