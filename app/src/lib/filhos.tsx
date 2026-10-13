import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { listarFilhos, type Aluno } from './api';
import { turmaAtual, type TurmaDoAluno } from './escola';
import { useSessao } from './sessao';

// Filhos do responsável logado, com a turma atual de cada um, e o filho escolhido (vale para todas as abas).

export type Filho = Aluno & { turmaAtual: TurmaDoAluno | null };

type Estado = {
  filhos: Filho[] | null;
  erro: string | null;
  selecionado: Filho | null;
  selecionar: (codigo: string) => void;
  recarregar: () => void;
};

const Contexto = createContext<Estado | null>(null);

async function buscarFilhos(): Promise<Filho[]> {
  const alunos = await listarFilhos();
  return Promise.all(alunos.map(async (a) => ({ ...a, turmaAtual: await turmaAtual(a.codigo).catch(() => null) })));
}

export function FilhosProvider({ children }: { children: ReactNode }) {
  const { usuarioId } = useSessao();
  const [carregado, setCarregado] = useState<{ dono: string; filhos: Filho[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    buscarFilhos()
      .then((filhos) => {
        if (!ativo) return;
        setCarregado({ dono: usuarioId, filhos });
        setErro(null);
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus filhos.'));
    return () => {
      ativo = false;
    };
  }, [usuarioId, versao]);

  // Ao sair ou trocar de conta, a lista anterior não aparece.
  const filhos = usuarioId && carregado?.dono === usuarioId ? carregado.filhos : usuarioId ? null : [];
  const selecionado = filhos?.find((f) => f.codigo === codigo) ?? filhos?.[0] ?? null;

  const valor: Estado = {
    filhos,
    erro,
    selecionado,
    selecionar: setCodigo,
    recarregar: () => setVersao((v) => v + 1),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFilhos() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useFilhos fora do FilhosProvider');
  return ctx;
}
