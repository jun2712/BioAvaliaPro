// Utilitários de WhatsApp: normaliza números com código do país (Brasil = 55)
// e monta o link de envio. Idempotente: números que já têm o código são mantidos.
export function normalizarWhatsApp(numero, codigoPais = "55") {
  const digitos = String(numero || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length >= 12 && digitos.startsWith(codigoPais)) return digitos;
  return codigoPais + digitos;
}

// Link de envio (api.whatsapp.com/send) com número sempre no formato 55...
export function linkWhatsApp(numero, textoCodificado) {
  const fone = normalizarWhatsApp(numero);
  const query = textoCodificado ? `&text=${textoCodificado}` : "";
  return fone
    ? `https://api.whatsapp.com/send?phone=${fone}${query}`
    : `https://api.whatsapp.com/send?text=${textoCodificado || ""}`;
}