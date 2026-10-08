// n8n · Code node (Run Once for All Items)
// Saída: um item por aluno → { id_aluno, nome, telefone e nome do responsável financeiro, curso }
const NO_ALUNOS = 'Busca Alunos';
const NO_RESPONSAVEIS = 'Busca Responsaveis';

// Celular → 55 + DDD + número (corrige máscara, texto, DDD repetido e falta do 9)
function celular(bruto) {
  let d = String(bruto ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === d.slice(2, 4)) d = d.slice(2);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + '9' + d.slice(2);
  return d.length === 11 && d[2] === '9' ? '55' + d : null;
}

// "MARIA DA SILVA" → "Maria da Silva" (de, da, do, das, dos, e ficam minúsculos)
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
function nomeProprio(bruto) {
  return String(bruto ?? '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

const itens = (no) => $(no).all().flatMap(({ json }) =>
  Array.isArray(json) ? json.flatMap((p) => p.itens ?? []) : (json.itens ?? [json]));

const alunos = itens(NO_ALUNOS);
const financeiros = itens(NO_RESPONSAVEIS).filter((r) => r.eResponsavelFinanceiro === 'Sim');

return alunos.map((a) => {
  // String nos dois lados: um endpoint pode mandar o id como número e o outro como texto
  const r = financeiros.find((x) => String(x.idDoAluno) === String(a.idDoAluno));
  return {
    json: {
      id_aluno: String(a.idDoAluno),
      nome: nomeProprio(a.nome),
      telefone: celular(r?.celular),
      celular_original: r?.celular ?? null, // conferência: veja o que veio quando telefone sair null
      nome_responsavel: r?.nome ? nomeProprio(r.nome) : null,
      curso: (a.descricaoUltimoCurso ?? '').trim(),
    },
  };
});
