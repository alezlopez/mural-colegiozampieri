import "server-only";

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Lê todas as linhas de uma consulta, de 1.000 em 1.000: o Supabase devolve no máximo 1.000 por vez e corta o
 * resto sem avisar. A consulta precisa de ordem estável (ex.: .order("codigo")).
 */
export async function lerTudo<T>(pagina: (de: number, ate: number) => Pagina<T>, tamanho = 1000): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < tamanho) return linhas;
  }
}
