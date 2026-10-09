/** CPF só com dígitos, se os dígitos verificadores conferem; senão null. */
export function normalizarCpf(entrada: string): string | null {
  const cpf = entrada.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return null;
  const dv = (base: string) => {
    const soma = [...base].reduce((t, d, i) => t + Number(d) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9)) === Number(cpf[9]) && dv(cpf.slice(0, 10)) === Number(cpf[10]) ? cpf : null;
}
