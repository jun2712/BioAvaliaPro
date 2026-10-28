import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/api/dataClient";
import AppShell from "@/components/AppShell";
import UsuariosTable from "@/components/admin/UsuariosTable";
import GoogleCompartilhadoCard from "@/components/admin/GoogleCompartilhadoCard";
import { carregarTudo } from "@/lib/carregarTudo";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

// Módulo de Administração: lista unificada de usuários e coaches — cada conta é
// um Coach (pode ter clientes e avaliações) e pode ter a permissão extra de
// Administrador. Acessível apenas a contas administradoras.
export default function Administracao() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);
  const [usuarios, setUsuarios] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [meuId, setMeuId] = useState(null);
  const [coachesSemConta, setCoachesSemConta] = useState([]);

  const carregar = async () => {
    const [users, cls, avs] = await Promise.all([
      db.entities.User.list("-created_date", 500),
      carregarTudo("Cliente"),
      carregarTudo("Avaliacao"),
    ]);
    setUsuarios(users);
    setClientes(cls);
    setAvaliacoes(avs);
    // Coaches existentes apenas nos registros (inclusive importações), sem conta no app
    const nomesUsuarios = new Set(
      users.flatMap((u) => [u.coach_nome, u.email, u.full_name].filter(Boolean).map((n) => n.trim().toLowerCase()))
    );
    const nomesRegistros = [...new Set([...cls, ...avs].map((r) => (r.coach || "").trim()).filter(Boolean))];
    setCoachesSemConta(nomesRegistros.filter((n) => !nomesUsuarios.has(n.toLowerCase())));
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await db.auth.me();
        setMeuId(me?.id || null);
        if (me?.role !== "admin") {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(true);
        await carregar();
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  if (isAdmin === null) {
    return (
      <AppShell title="Administração" subtitle="Usuários, coaches e permissões">
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Administração">
        <Card className="p-12 text-center border-dashed">
          <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">Este módulo é exclusivo para administradores.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Administração" subtitle="Usuários, coaches e permissões">
      {!usuarios ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div>
          <GoogleCompartilhadoCard />
          <p className="text-sm text-muted-foreground mb-4 max-w-xl">
            Cada usuário do app é um Coach e pode ter clientes e avaliações. Administrador é uma permissão
            extra, que dá acesso também aos dados dos demais coaches e à gestão de usuários.
          </p>
          <UsuariosTable
            usuarios={usuarios}
            clientes={clientes}
            avaliacoes={avaliacoes}
            coachesSemConta={coachesSemConta}
            meuId={meuId}
            onAtualizar={carregar}
            onVerClientes={(nome) => navigate(`/clientes?coach=${encodeURIComponent(nome)}`)}
          />
        </div>
      )}
    </AppShell>
  );
}