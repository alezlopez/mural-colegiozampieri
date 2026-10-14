// Ocorrências do aluno: rótulos usados pelo painel, pela área do professor (e copiados no app).

export const TIPOS_OCORRENCIA = { disciplinar: "Disciplinar", pedagogica: "Pedagógica", outra: "Outra" } as const;
export type TipoOcorrencia = keyof typeof TIPOS_OCORRENCIA;
export const ehTipoOcorrencia = (v: unknown): v is TipoOcorrencia => typeof v === "string" && v in TIPOS_OCORRENCIA;

export const STATUS_OCORRENCIA = {
  pendente: "Aguardando a coordenação",
  publicada: "Enviada à família",
  interna: "Registro interno",
} as const;
export type StatusOcorrencia = keyof typeof STATUS_OCORRENCIA;

export type Ocorrencia = {
  id: string;
  aluno_codigo: string;
  turma_id: number | null;
  ano: number;
  data: string;
  tipo: TipoOcorrencia;
  descricao: string;
  providencia: string | null;
  disciplina_id: number | null;
  registrado_por_nome: string;
  status: StatusOcorrencia;
  exige_ciencia: boolean;
  publicada_em: string | null;
  ciencia_em: string | null;
  criado_em: string;
};

export const CAMPOS_OCORRENCIA =
  "id,aluno_codigo,turma_id,ano,data,tipo,descricao,providencia,disciplina_id,registrado_por_nome,status,exige_ciencia,publicada_em,ciencia_em,criado_em";
