import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Moldura das páginas legais (privacidade e termos).
export default function LegalLayout({ titulo, atualizacao, children }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold tracking-tight">{titulo}</h1>
            <p className="text-xs text-muted-foreground">BioAvalia App · atualizado em {atualizacao}</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <div className="rounded-2xl border bg-card p-6 sm:p-10 shadow-sm space-y-7">{children}</div>
      </main>
    </div>
  );
}