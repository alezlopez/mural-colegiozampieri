// Áreas do painel e o que cada perfil pode em cada uma. Direção pode tudo (e é quem gerencia a equipe);
// coordenação e secretaria seguem a tabela perfil_permissoes, editável pela direção em Equipe.

export const AREAS = {
  comunicacao: { rotulo: "Comunicação", descricao: "Publicações e fotos dos alunos" },
  secretaria: { rotulo: "Secretaria", descricao: "Rematrícula" },
  estrutura: { rotulo: "Estrutura pedagógica", descricao: "Matriz, turmas e alunos, disciplinas, professores, horários e calendário" },
  avaliacao: { rotulo: "Avaliação", descricao: "Regras de notas e publicação do boletim" },
  acompanhamento: { rotulo: "Acompanhamento", descricao: "Visão geral, professores, alunos em risco, ficha do aluno, aulas não lançadas, planejamentos (visto) e boletins" },
  equipe: { rotulo: "Equipe", descricao: "Usuários do painel e permissões (só direção)" },
} as const;
export type Area = keyof typeof AREAS;
export type Nivel = "nenhum" | "ver" | "editar";
export type Perfil = "direcao" | "coordenacao" | "secretaria";
export type Permissoes = Record<Area, Nivel>;

export const PERFIS: Record<Perfil, string> = { direcao: "Direção", coordenacao: "Coordenação", secretaria: "Secretaria" };

const ORDEM: Record<Nivel, number> = { nenhum: 0, ver: 1, editar: 2 };
export const alcanca = (tem: Nivel, precisa: Nivel) => ORDEM[tem] >= ORDEM[precisa];

/** Área de cada caminho do painel (para o menu e o aviso de "somente leitura"). */
export function areaDoCaminho(pathname: string): Area | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p.startsWith("/posts") || p.startsWith("/fotos")) return "comunicacao";
  if (p.startsWith("/rematricula")) return "secretaria";
  if (["/matriz", "/turmas", "/disciplinas", "/professores", "/horarios", "/calendario"].some((r) => p.startsWith(r))) return "estrutura";
  if (p.startsWith("/avaliacao")) return "avaliacao";
  if (["/acompanhamento", "/alunos", "/pendencias", "/planejamentos", "/boletim"].some((r) => p.startsWith(r))) return "acompanhamento";
  if (p.startsWith("/equipe")) return "equipe";
  return null;
}

export function permissoesDe(perfil: Perfil, linhas: { area: string; nivel: string }[]): Permissoes {
  const todas = Object.keys(AREAS) as Area[];
  if (perfil === "direcao") return Object.fromEntries(todas.map((a) => [a, "editar"])) as Permissoes;
  return Object.fromEntries(
    todas.map((a) => [a, a === "equipe" ? "nenhum" : ((linhas.find((l) => l.area === a)?.nivel as Nivel | undefined) ?? "nenhum")]),
  ) as Permissoes;
}

/** Itens do menu do painel, agrupados, com a área que cada um exige. */
export const MENU: { titulo: string; itens: { href: string; rotulo: string; area: Area; contador?: "fotos" }[] }[] = [
  {
    titulo: "Comunicação",
    itens: [
      { href: "/", rotulo: "Publicações", area: "comunicacao" },
      { href: "/fotos", rotulo: "Fotos dos alunos", area: "comunicacao", contador: "fotos" },
    ],
  },
  {
    titulo: "Secretaria",
    itens: [{ href: "/rematricula", rotulo: "Rematrícula", area: "secretaria" }],
  },
  {
    titulo: "Pedagógico",
    itens: [
      { href: "/matriz", rotulo: "Matriz curricular", area: "estrutura" },
      { href: "/turmas", rotulo: "Turmas", area: "estrutura" },
      { href: "/disciplinas", rotulo: "Disciplinas", area: "estrutura" },
      { href: "/professores", rotulo: "Professores", area: "estrutura" },
      { href: "/horarios", rotulo: "Horários", area: "estrutura" },
      { href: "/calendario", rotulo: "Calendário", area: "estrutura" },
      { href: "/avaliacao", rotulo: "Avaliação e boletim", area: "avaliacao" },
    ],
  },
  {
    titulo: "Coordenação",
    itens: [
      { href: "/acompanhamento", rotulo: "Visão geral", area: "acompanhamento" },
      { href: "/acompanhamento/professores", rotulo: "Professores em dia", area: "acompanhamento" },
      { href: "/acompanhamento/alunos", rotulo: "Alunos em risco", area: "acompanhamento" },
      { href: "/alunos", rotulo: "Ficha do aluno", area: "acompanhamento" },
      { href: "/pendencias", rotulo: "Aulas não lançadas", area: "acompanhamento" },
      { href: "/planejamentos", rotulo: "Planejamentos", area: "acompanhamento" },
      { href: "/boletim", rotulo: "Boletins", area: "acompanhamento" },
    ],
  },
  {
    titulo: "Administração",
    itens: [{ href: "/equipe", rotulo: "Equipe e permissões", area: "equipe" }],
  },
];

/** Só os grupos e itens que o perfil pode ver. */
export const menuDe = (p: Permissoes) =>
  MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => alcanca(p[i.area], "ver")) })).filter((g) => g.itens.length > 0);

/** Primeira tela que o perfil pode abrir (destino do "voltar" quando o início não é permitido). */
export const inicioDe = (p: Permissoes) => menuDe(p)[0]?.itens[0]?.href ?? null;
