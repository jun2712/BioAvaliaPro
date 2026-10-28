import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu } from "lucide-react";

const NAV_ITENS = [
  { label: "Painel", to: "/" },
  { label: "Clientes", to: "/clientes" },
  { label: "Relatórios", to: "/relatorios" },
  { label: "Anamnese", to: "/anamnese" },
  { label: "Agenda", to: "/agenda" },
  { label: "Importar/Exportar", to: "/import-export" },
  { label: "Configurações", to: "/configuracoes" },
];

export default function AppShell({ title, subtitle, actions, children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Módulo de Administração visível apenas para contas de administrador
  const itens = user?.role === "admin"
    ? [...NAV_ITENS, { label: "Administração", to: "/administracao" }]
    : NAV_ITENS;
  const ativo = (item) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to));
  const itemAtual = itens.find(ativo);
  const [saindo, setSaindo] = useState(false);

  // Encerra a sessão e volta para a tela de login (permite trocar de conta)
  const sair = async () => {
    setSaindo(true);
    await base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Ações da página: botões compactos no celular, normais no desktop */}
            {actions && (
              <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end [&_button]:h-9 [&_button]:px-3 [&_button]:text-xs [&_button]:gap-1.5 sm:[&_button]:h-12 sm:[&_button]:px-6 sm:[&_button]:text-sm sm:[&_button]:gap-2">
                {actions}
              </div>
            )}
            <span className="text-xs text-muted-foreground hidden md:block max-w-[160px] truncate pl-2">
              {user?.coach_nome || user?.email}
            </span>
            {/* Celular: menu hamburger (módulos + Sair) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden h-9 w-9" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {itens.map((item) => (
                  <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)}>
                    {item.label}
                    {itemAtual?.to === item.to && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={sair} disabled={saindo} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Desktop: sair compacto (só o ícone) */}
            <Button variant="outline" size="icon" className="hidden sm:inline-flex h-9 w-9" onClick={sair} disabled={saindo} title="Sair da conta">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <nav className="hidden sm:flex max-w-6xl mx-auto px-4 sm:px-6 pt-2 pb-2 gap-1 overflow-x-auto">
          {itens.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                ativo(item)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}