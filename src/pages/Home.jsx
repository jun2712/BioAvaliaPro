import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/AppShell";
import ClienteForm from "@/components/ClienteForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { UserPlus, Search, Phone, Ruler, Cake, ChevronRight, Loader2 } from "lucide-react";
import { calcularIdade } from "@/lib/bioRefs";
import { parseDataLocal } from "@/lib/datas";
import { garantirCodigos } from "@/lib/clienteCodigo";
import { carregarTudo } from "@/lib/carregarTudo";
import CoachPrompt from "@/components/CoachPrompt";
import StatusBadge from "@/components/cliente/StatusBadge";
import { STATUS_CLIENTE, statusDe } from "@/lib/fluxo";

export default function Home() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [coachFiltro, setCoachFiltro] = useState(() => new URLSearchParams(window.location.search).get("coach") || "todos");
  const [limite, setLimite] = useState(60);
  const navigate = useNavigate();
  const location = useLocation();

  // Atalho vindo do módulo de administração: /?coach=Nome do coach
  useEffect(() => {
    const coachUrl = new URLSearchParams(location.search).get("coach");
    if (coachUrl) setCoachFiltro(coachUrl);
  }, [location.search]);

  const carregar = async () => {
    setLoading(true);
    try {
      // Base completa: todas as páginas, para a busca alcançar todos os clientes
      const lista = await carregarTudo("Cliente");
      // Garante que todos os clientes tenham um ID interno
      await garantirCodigos(lista);
      // Ordem alfabética (pt-BR, ignorando acentos) para facilitar a busca
      lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
      setClientes(lista);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      // Conversão única: alturas cadastradas em metros passam a centímetros
      if (localStorage.getItem("bioavalia_altura_cm") !== "1") {
        try {
          await base44.entities.Cliente.updateMany({ altura: { $lt: 3 } }, { $mul: { altura: 100 } });
        } finally {
          localStorage.setItem("bioavalia_altura_cm", "1");
        }
      }
      carregar();
    })();
  }, []);

  // Nova busca ou filtro sempre recomeça do primeiro lote de resultados
  useEffect(() => { setLimite(60); }, [busca, grupoFiltro, statusFiltro, coachFiltro]);

  const filtrados = clientes.filter((c) =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) &&
    (grupoFiltro === "todos" || c.grupo === grupoFiltro) &&
    (statusFiltro === "todos" || statusDe(c) === statusFiltro) &&
    (coachFiltro === "todos" || c.coach === coachFiltro)
  );

  const hoje = new Date();
  const aniversariantesHoje = clientes.filter((c) => {
    if (!c.data_nascimento) return false;
    const d = parseDataLocal(c.data_nascimento);
    return !!d && d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth();
  });

  const grupos = [...new Set(clientes.map((c) => (c.grupo || "").trim()).filter(Boolean))].sort();
  const coaches = [...new Set([
    ...clientes.map((c) => (c.coach || "").trim()).filter(Boolean),
    ...(coachFiltro !== "todos" ? [coachFiltro] : []),
  ])].sort();

  return (
    <AppShell
      title="Clientes"
      subtitle="Avaliações físicas e bioimpedância"
      actions={
        <>
          {aniversariantesHoje.length > 0 && (
            <Button variant="outline" onClick={() => navigate("/agenda")} title="Aniversariantes de hoje">
              <Cake className="w-4 h-4 mr-2 text-pink-500" /><span className="hidden sm:inline">{aniversariantesHoje.length} aniversariante(s) hoje</span>
            </Button>
          )}
          <Button onClick={() => setOpen(true)} title="Novo cliente"><UserPlus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Novo cliente</span></Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-3 mb-6">
        <p className="w-full text-xs text-muted-foreground">
          {loading
            ? "Carregando clientes..."
            : filtrados.length === clientes.length
              ? `${clientes.length} cliente(s) cadastrado(s)`
              : `${filtrados.length} de ${clientes.length} cliente(s)`}
        </p>
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente..." className="pl-9 h-10" />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[180px] h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_CLIENTE.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {grupos.length > 0 && (
          <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
            <SelectTrigger className="w-[190px] h-10"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os grupos</SelectItem>
              {grupos.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {coaches.length > 0 && (
          <Select value={coachFiltro} onValueChange={setCoachFiltro}>
            <SelectTrigger className="w-[190px] h-10"><SelectValue placeholder="Coach" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os coaches</SelectItem>
              {coaches.map((co) => (
                <SelectItem key={co} value={co}>{co}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <p className="font-medium text-foreground">
            {clientes.length > 0 ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </p>
          <p className="text-sm mt-1">
            {clientes.length > 0 ? "Ajuste a busca ou os filtros." : 'Clique em "Novo cliente" para começar.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.slice(0, limite).map((c) => (
            <Card key={c.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/cliente/${c.id}`)}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{c.nome}</h3>
                    {c.codigo && (
                      <span className="text-[11px] rounded-full border bg-muted px-2 py-0.5 text-muted-foreground font-mono">{c.codigo}</span>
                    )}
                    {c.grupo && (
                      <span className="text-[11px] rounded-full border bg-primary/5 px-2 py-0.5 text-muted-foreground truncate max-w-[110px]">{c.grupo}</span>
                    )}
                    <StatusBadge status={statusDe(c)} />
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {c.data_nascimento && (
                      <div className="flex items-center gap-1.5"><Cake className="w-3.5 h-3.5" />{calcularIdade(c.data_nascimento)} anos · {c.sexo}</div>
                    )}
                    {c.whatsapp && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{c.whatsapp}</div>}
                    {c.altura && <div className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" />{c.altura} cm</div>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && filtrados.length > limite && (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-xs text-muted-foreground">{limite} de {filtrados.length} exibidos</p>
          <Button variant="outline" onClick={() => setLimite((l) => l + 60)}>Mostrar mais</Button>
        </div>
      )}

      <CoachPrompt />
      <ClienteForm open={open} onClose={() => setOpen(false)} onSaved={carregar} clientes={clientes} />
    </AppShell>
  );
}