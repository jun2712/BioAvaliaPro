import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calculator } from "lucide-react";
import OptionGroup from "./OptionGroup";
import { NIVEL_ATIVIDADE, OBJETIVO, SEXO, USA_GLP1 } from "@/lib/proteina";

const numero = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export default function ProteinaForm({ inicial, enviando, onSubmit }) {
  const [peso, setPeso] = useState(inicial?.peso != null ? String(inicial.peso) : "");
  const [idade, setIdade] = useState(inicial?.idade != null ? String(inicial.idade) : "");
  const [altura, setAltura] = useState(inicial?.altura != null ? String(inicial.altura) : "");
  const [sexo, setSexo] = useState(inicial?.sexo || "");
  const [nivel, setNivel] = useState(inicial?.nivel_atividade || "");
  const [objetivo, setObjetivo] = useState(inicial?.objetivo || "");
  const [glp1, setGlp1] = useState(
    inicial?.usa_glp1 === true ? "sim" : inicial?.usa_glp1 === false ? "nao" : ""
  );
  const [erro, setErro] = useState("");

  const enviar = (e) => {
    e.preventDefault();
    const pesoNum = numero(peso);
    const idadeNum = numero(idade);
    const alturaNum = numero(altura);
    if (!pesoNum || pesoNum < 25 || pesoNum > 300) {
      setErro("Informe o seu peso em kg (entre 25 e 300).");
      return;
    }
    if (!idadeNum || idadeNum < 12 || idadeNum > 110) {
      setErro("Informe a sua idade em anos (entre 12 e 110).");
      return;
    }
    if (!alturaNum || alturaNum < 100 || alturaNum > 250) {
      setErro("Informe a sua altura em cm (entre 100 e 250).");
      return;
    }
    if (!sexo || !nivel || !objetivo || !glp1) {
      setErro("Responda todas as perguntas para calcular.");
      return;
    }
    setErro("");
    onSubmit({
      peso: pesoNum,
      idade: Math.round(idadeNum),
      altura: Math.round(alturaNum),
      sexo,
      nivel_atividade: nivel,
      objetivo,
      usa_glp1: glp1 === "sim",
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="peso">Peso atual (kg)</Label>
          <Input
            id="peso"
            inputMode="decimal"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="Ex: 72,5"
            className="h-12 text-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idade">Idade (anos)</Label>
          <Input
            id="idade"
            inputMode="numeric"
            value={idade}
            onChange={(e) => setIdade(e.target.value)}
            placeholder="Ex: 42"
            className="h-12 text-lg"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="altura">Altura (cm)</Label>
        <Input
          id="altura"
          inputMode="numeric"
          value={altura}
          onChange={(e) => setAltura(e.target.value)}
          placeholder="Ex: 175"
          className="h-12 text-lg"
        />
      </div>

      <OptionGroup titulo="Sexo" opcoes={SEXO} value={sexo} onChange={setSexo} />
      <OptionGroup
        titulo="Nível de atividade física"
        ajuda="Considere as últimas semanas de treino."
        opcoes={NIVEL_ATIVIDADE}
        value={nivel}
        onChange={setNivel}
      />
      <OptionGroup
        titulo="Objetivo principal"
        opcoes={OBJETIVO}
        value={objetivo}
        onChange={setObjetivo}
      />
      <OptionGroup
        titulo="Você usa análogos de GLP-1? (Ozempic, Mounjaro…)"
        ajuda="A medicação muda a necessidade de proteína para proteger a massa muscular."
        opcoes={USA_GLP1}
        value={glp1}
        onChange={setGlp1}
      />

      {erro && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
        Calcular minha meta proteica
      </Button>
    </form>
  );
}