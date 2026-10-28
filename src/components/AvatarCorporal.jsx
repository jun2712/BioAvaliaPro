import React from "react";
import { getAvatarNivel, AVATAR_LABELS } from "@/lib/bioRefs";

// Escala de avatares: tira com 8 figuras por sexo, nível atual destacado.
const IMAGENS = {
  Feminino: "https://media.base44.com/images/public/6ab06f9fad8e8449fc47fdc9/5f57b9790_generated_image.png",
  Masculino: "https://media.base44.com/images/public/6ab06f9fad8e8449fc47fdc9/344aebd6d_generated_image.png",
};

export default function AvatarCorporal({ cliente, avaliacao, imc }) {
  if (!cliente?.sexo || !avaliacao) return null;
  const nivel = getAvatarNivel(cliente.sexo, avaliacao.gordura_corporal, imc ?? avaliacao.imc);
  const url = IMAGENS[cliente.sexo] || IMAGENS.Masculino;
  const indice = nivel.indice;

  return (
    <div>
      <div className="relative rounded-xl h-40 sm:h-52 overflow-hidden bg-card">
        {/* <img> direto + altura fixa: corta o espaço em branco da tira e compacta a seção */}
        <img src={url} className="w-full h-full object-cover object-center" alt="Escala de avatares de composição corporal" />
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={`absolute top-0 bottom-0 border-2 rounded-lg transition-colors ${
              i === indice ? "border-emerald-400 bg-emerald-100/20" : "border-transparent bg-white/60"
            }`}
            style={{ left: `${i * 12.5}%`, width: "12.5%" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-8 mt-2 gap-1">
        {AVATAR_LABELS.map((label, i) => (
          <span
            key={label}
            className={`text-center text-[11px] leading-tight ${
              i === indice ? "font-semibold text-emerald-700" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {indice != null ? (
          <>Nível atual: <span className="font-medium text-foreground">{nivel.label}</span>{nivel.metrica && ` · definido pelo ${nivel.metrica}`}</>
        ) : (
          "Sem dados de gordura corporal ou IMC para definir o nível."
        )}
      </p>
    </div>
  );
}