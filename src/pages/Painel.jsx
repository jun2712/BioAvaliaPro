import React, { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ClienteForm from "@/components/ClienteForm";
import Indicadores from "@/components/painel/Indicadores";
import AgendaHoje from "@/components/painel/AgendaHoje";
import AnamnesesPendentes from "@/components/painel/AnamnesesPendentes";
import AtencaoList from "@/components/painel/AtencaoList";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { dataHojeLocal } from "@/lib/datas";
import { carregarTudo } from "@/lib/carregarTudo";
import { calcularAtencao, somarDiasISO, statusDe, TIPO_AGENDAMENTO_LABEL } from "@/lib/fluxo";

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Resumo de um conjunto de registros (base inteira ou apenas os do coach).
const resumoDe = (clientes, avaliacoes, agenda, anamneses, mes, hoje) => ({
  clientes: clientes.length,
  ativos: clientes.filter((c) => statusDe(c) === "ativo").length,
  avaliacoesMes: avaliacoes.filter((a) => (a.data || "").startsWith(mes)).length,
  pendentes: anamneses.length,
  hoje: agenda.filter((a) => a.data === hoje).length,
  semana: agenda.length,
});

// Painel de controle: visão do dia e dos acompanhamentos que pedem ação.
export default function Painel() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [anamneses, setAnamneses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);

  const hoje = dataHojeLocal();
  const emSeteDias = somarDiasISO(7);

  const carregar = async () => {
    setLoading(true);
    try {
      const [cls, avs, ags, ans] = await Promise.all([
        carregarTudo("Cliente"),
        carregarTudo("Avaliacao", "-data"),
        carregarTudo("Agendamento", "data", { status: "agendado", data: { $gte: hoje, $lte: emSeteDias } }),
        carregarTudo("Anamnese", "-created_date", { status: "pendente" }),
      ]);
      setClientes(cls);
      setAvaliacoes(avs);
      setAgendamentos(ags);
      setAnamneses(ans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const dados = useMemo(() => {
    const porId = new Map(clientes.map((c) => [c.id, c]));
    const ultimaPorCliente = new Map();
    avaliacoes.forEach((a) => {
      if (!a.cliente_id) return;
      const atual = ultimaPorCliente.get(a.cliente_id);
      if (!atual || (a.data || "") > (atual.data || "")) ultimaPorCliente.set(a.cliente_id, a);
    });

    const agenda = agendamentos
      .map((a) => ({
        ...a,
        nome: porId.get(a.cliente_id)?.nome || "Cliente",
        whatsapp: porId.get(a.cliente_id)?.whatsapp || "",
        tipoLabel: TIPO_AGENDAMENTO_LABEL[a.tipo || "avaliacao"],
      }))
      .sort((a, b) => `${a.data} ${a.hora || ""}`.localeCompare(`${b.data} ${b.hora || ""}`));

    // Coach dono do registro: campo Coach do próprio registro quando existir;
    // caso contrário, o Coach do cliente vinculado.
    const meuCoach = (user?.coach_nome || "").trim().toLowerCase();
    const coachDoRegistro = (r) => {
      const proprio = (r.coach || "").trim().toLowerCase();
      if (proprio) return proprio;
      const vinculado = (porId.get(r.cliente_id)?.coach || "").trim().toLowerCase();
      if (vinculado) return vinculado;
      return user?.id && r.created_by_id === user.id ? meuCoach : "";
    };
    const meus = (lista) => (meuCoach ? lista.filter((r) => coachDoRegistro(r) === meuCoach) : []);

    const meusClientes = meus(clientes);
    const meusAgenda = meus(agenda);
    const minhasAnamneses = meus(anamneses);
    const mes = hoje.slice(0, 7);

    return {
      admin: user?.role === "admin",
      nomeCoach: (user?.coach_nome || user?.full_name || user?.email || "").trim(),
      todaBase: {
        indicadores: resumoDe(clientes, avaliacoes, agenda, anamneses, mes, hoje),
        agenda,
        atencao: calcularAtencao(clientes, ultimaPorCliente),
        anamneses,
      },
      meus: {
        indicadores: resumoDe(meusClientes, meus(avaliacoes), meusAgenda, minhasAnamneses, mes, hoje),
        agenda: meusAgenda,
        atencao: calcularAtencao(meusClientes, ultimaPorCliente),
        anamneses: minhasAnamneses,
      },
    };
  }, [clientes, avaliacoes, agendamentos, anamneses, hoje, user]);

  // Listas do dia seguem o escopo de quem está logado: administradores veem a
  // base inteira; demais coaches veem apenas os próprios acompanhamentos.
  const escopo = dados.admin ? dados.todaBase : dados.meus;

  const primeiroNome = (user?.coach_nome || user?.full_name || user?.email || "").split(/[\s@]/)[0];
  const hora = new Date().getHours();
  const saudacao = `${hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}${primeiroNome ? ", " + primeiroNome : ""}`;
  const dataLonga = capitalizar(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));

  return (
    <AppShell
      title={saudacao}
      subtitle={dataLonga}
      actions={
        <Button onClick={() => setNovoOpen(true)} title="Novo cliente">
          <UserPlus className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Novo cliente</span>
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-8">
          {dados.admin && (
            <Indicadores titulo="Toda a base" subtitulo="Todos os coaches" m={dados.todaBase.indicadores} />
          )}
          <Indicadores
            titulo={dados.admin ? "Meus números" : ""}
            subtitulo={dados.admin ? dados.nomeCoach : ""}
            m={dados.meus.indicadores}
          />

          <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-6 items-start">
            <div className="space-y-6">
              <AgendaHoje itens={escopo.agenda.filter((a) => a.data === hoje)} totalSemana={escopo.agenda.length} />
              <AtencaoList itens={escopo.atencao.slice(0, 6)} total={escopo.atencao.length} />
            </div>
            <AnamnesesPendentes itens={escopo.anamneses.slice(0, 4)} total={escopo.anamneses.length} />
          </div>
        </div>
      )}

      <ClienteForm open={novoOpen} onClose={() => setNovoOpen(false)} onSaved={carregar} clientes={clientes} />
    </AppShell>
  );
}