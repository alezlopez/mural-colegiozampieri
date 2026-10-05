import type { Categoria } from './categorias';
import { supabase } from './supabase';

// O app lê o Supabase com a chave anon. Visitante só vê publicações gerais;
// responsável logado vê também as das turmas dos filhos (regras RLS no banco).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Servidor do painel (admin/), que valida código do aluno + telefone.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

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
  turmas: string[] | null;
  publicado_em: string;
  post_imagens: Imagem[];
};

export type Aluno = { codigo: string; nome: string; turma: string };

const CAMPOS =
  'id,categoria,titulo,corpo,data_evento,fixado,turmas,publicado_em,post_imagens(storage_path,largura,altura,posicao)';

function verificarConfig() {
  if (!SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env');
  }
}

export async function listarPosts(opcoes: { categoria?: Categoria; pagina: number }): Promise<Post[]> {
  verificarConfig();
  let consulta = supabase
    .from('posts')
    .select(CAMPOS)
    .eq('status', 'publicado')
    .order('fixado', { ascending: false })
    .order('publicado_em', { ascending: false })
    .order('posicao', { referencedTable: 'post_imagens', ascending: true })
    .range(opcoes.pagina * TAMANHO_PAGINA, (opcoes.pagina + 1) * TAMANHO_PAGINA - 1);
  if (opcoes.categoria) consulta = consulta.eq('categoria', opcoes.categoria);
  const { data, error } = await consulta;
  if (error) throw new Error('Não foi possível carregar o mural.');
  return data as Post[];
}

export async function buscarPost(id: string): Promise<Post | null> {
  verificarConfig();
  const { data, error } = await supabase
    .from('posts')
    .select(CAMPOS)
    .eq('id', id)
    .order('posicao', { referencedTable: 'post_imagens', ascending: true })
    .maybeSingle();
  if (error) throw new Error('Não foi possível carregar a publicação.');
  return data as Post | null;
}

export async function listarFilhos(): Promise<Aluno[]> {
  const { data, error } = await supabase.from('alunos').select('codigo,nome,turma').order('nome');
  if (error) throw new Error('Não foi possível carregar os alunos.');
  return data;
}

export async function registrarPushToken(token: string, plataforma: 'ios' | 'android') {
  const { error } = await supabase.rpc('registrar_push_token', { p_token: token, p_plataforma: plataforma });
  if (error) throw new Error(`Falha ao registrar dispositivo: ${error.message}`);
}

/** Passo 1 do login: confere código do aluno + telefone no cadastro da escola. */
export async function solicitarAcesso(codigoAluno: string, telefone: string): Promise<string> {
  if (!API_URL) throw new Error('Configure EXPO_PUBLIC_API_URL no arquivo .env');
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/auth/solicitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_aluno: codigoAluno, telefone }),
    });
  } catch {
    throw new Error('Sem conexão. Verifique sua internet.');
  }
  const corpo = (await resp.json().catch(() => ({}))) as { erro?: string; telefone?: string };
  if (!resp.ok || !corpo.telefone) throw new Error(corpo.erro ?? 'Não foi possível validar os dados.');
  return corpo.telefone;
}

/** Passo 2: o Supabase gera o código e o servidor o entrega por WhatsApp. */
export async function enviarCodigo(telefone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: telefone, options: { shouldCreateUser: false } });
  if (error) {
    if (error.status === 429) throw new Error('Aguarde alguns segundos antes de pedir outro código.');
    throw new Error('Não foi possível enviar o código pelo WhatsApp. Tente novamente.');
  }
}

/** Passo 3: confere o código digitado e abre a sessão. */
export async function confirmarCodigo(telefone: string, codigo: string) {
  const { error } = await supabase.auth.verifyOtp({ phone: telefone, token: codigo, type: 'sms' });
  if (error) throw new Error('Código incorreto ou expirado.');
}

export function urlImagem(storagePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGENS}/${storagePath}`;
}
