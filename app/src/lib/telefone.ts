/** Máscara de celular brasileiro: "(11) 99999-8888". */
export function mascararTelefone(texto: string) {
  const d = texto.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "+5511999998888" → "(11) 99999-8888" */
export function exibirTelefone(e164: string) {
  return mascararTelefone(e164.replace(/\D/g, '').replace(/^55/, ''));
}
