import type { Categoria } from './categorias';

// Acesso público ao Supabase via REST (PostgREST). O app não tem login:
// a chave anon só enxerga o que as políticas RLS liberam (posts publicados).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const BUCKET_IMAGENS = 'post-imagens';
export const TAMANHO_PAGINA = 20;

export type Imagem = {
  storage_path: string;
  largura: number | null;
  altura: number | null;
  posicao: number;
};

export type Post = {
  id: string;
  categoria: Categoria;
  titulo: string;
  corpo: string;
  data_evento: string | null;
  fixado: boolean;
  publicado_em: string;
  post_imagens: Imagem[];
};

const CAMPOS = 'id,categoria,titulo,corpo,data_evento,fixado,publicado_em,post_imagens(storage_path,largura,altura,posicao)';

function headers(extra?: Record<string, string>) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env');
  }
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
    ...extra,
  };
}

async function get<T>(caminho: string): Promise<T> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { headers: headers() });
  if (!resp.ok) {
    throw new Error(`Falha ao carregar (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export async function listarPosts(opcoes: { categoria?: Categoria; pagina: number }): Promise<Post[]> {
  const params = new URLSearchParams({
    select: CAMPOS,
    status: 'eq.publicado',
    order: 'fixado.desc,publicado_em.desc',
    'post_imagens.order': 'posicao.asc',
    limit: String(TAMANHO_PAGINA),
    offset: String(opcoes.pagina * TAMANHO_PAGINA),
  });
  if (opcoes.categoria) params.set('categoria', `eq.${opcoes.categoria}`);
  return get<Post[]>(`posts?${params.toString()}`);
}

export async function buscarPost(id: string): Promise<Post | null> {
  const params = new URLSearchParams({
    select: CAMPOS,
    id: `eq.${id}`,
    'post_imagens.order': 'posicao.asc',
  });
  const linhas = await get<Post[]>(`posts?${params.toString()}`);
  return linhas[0] ?? null;
}

export async function registrarPushToken(token: string, plataforma: 'ios' | 'android') {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_push_token`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_token: token, p_plataforma: plataforma }),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao registrar dispositivo (${resp.status})`);
  }
}

export function urlImagem(storagePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGENS}/${storagePath}`;
}
