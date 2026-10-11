/**
 * Normaliza telefone brasileiro para E.164 sem "+" (formato do Supabase Auth): 55 + DDD + número.
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888" etc. Retorna null se inválido.
 */
export function normalizarTelefone(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return /^55[1-9][0-9]{9,10}$/.test(digitos) ? digitos : null;
}

/** "5511996525783" → "(11) 99652-5783" */
export function exibirTelefone(e164: string) {
  const d = e164.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : e164;
}
