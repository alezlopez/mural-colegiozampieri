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

const itens = (no) => $(no).all().flatMap(({ json }) =>
  Array.isArray(json) ? json.flatMap((p) => p.itens ?? []) : (json.itens ?? [json]));

const alunos = itens(NO_ALUNOS);
const financeiros = itens(NO_RESPONSAVEIS).filter((r) => r.eResponsavelFinanceiro === 'Sim');

return alunos.map((a) => {
  const r = financeiros.find((x) => x.idDoAluno === a.idDoAluno);
  return {
    json: {
      id_aluno: String(a.idDoAluno),
      nome: String(a.nome ?? '').replace(/\s+/g, ' ').trim(),
      telefone: celular(r?.celular),
      nome_responsavel: r?.nome ?? null,
      curso: (a.descricaoUltimoCurso ?? '').trim(),
    },
  };
});
