import "server-only";

// Cliente da API Integra da Mhund (somente leitura). Documentação: https://api-integra.mhund.com.br/swagger/v1/swagger.json
// Fonte TEMPORÁRIA do cadastro escolar enquanto ele estiver na Mhund.

const BASE = "https://api-integra.mhund.com.br";

type Pagina<T> = { status: unknown; quantidadeDePaginas?: number; mensagem?: string | null; itens?: T[] };

export type MhundCurso = {
  idDoCurso: number;
  ano: string;
  descricaoDoCurso: string;
  nomeReduzido: string | null;
  turno: string | null;
  turma: string | null;
  descricaoDaSerieDoCurso: string | null;
  segmento: string | null;
};
export type MhundDisciplina = { idDaDisciplina: number; nomeDaDisciplina: string; abreviacaoDaDisciplina: string | null };
export type MhundProfessor = { idDoProfessor: number; nome: string; email: string | null };
export type MhundGrade = { idDoCurso: number; idDaDisciplina: number; idDoProfessor: number | null };
export type MhundMatricula = {
  idDoAluno: number;
  idDoCurso: number;
  numeroDeChamada: number | null;
  situacao: string | null;
};

export class ClienteMhund {
  private chaveTemporaria: string | null = null;

  constructor(private readonly chaveCliente: string) {}

  static doAmbiente() {
    const chave = process.env.MHUND_CHAVE_CLIENTE;
    if (!chave) throw new Error("MHUND_CHAVE_CLIENTE não configurada");
    return new ClienteMhund(chave);
  }

  private async chave() {
    if (this.chaveTemporaria) return this.chaveTemporaria;
    const resp = await fetch(`${BASE}/ChaveTemporaria`, { headers: { chaveDoCliente: this.chaveCliente }, cache: "no-store" });
    if (!resp.ok) throw new Error(`Mhund: chave temporária recusada (${resp.status})`);
    const corpo = (await resp.json()) as { chave?: string };
    if (!corpo.chave) throw new Error("Mhund: resposta sem chave temporária");
    this.chaveTemporaria = corpo.chave;
    return corpo.chave;
  }

  private async buscar(url: URL) {
    return fetch(url, { headers: { chaveDoCliente: this.chaveCliente, chaveTemporaria: await this.chave() }, cache: "no-store" });
  }

  /** Busca todas as páginas de um endpoint de listagem. */
  async listar<T>(caminho: string, parametros: Record<string, string | number> = {}): Promise<T[]> {
    const itens: T[] = [];
    for (let pagina = 1; ; pagina++) {
      const url = new URL(`${BASE}/${caminho}`);
      for (const [k, v] of Object.entries({ ...parametros, pagina })) url.searchParams.set(k, String(v));
      let resp = await this.buscar(url);
      if (resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 3000)); // falha momentânea: uma nova tentativa
        resp = await this.buscar(url);
      }
      if (!resp.ok) throw new Error(`Mhund ${caminho}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
      const corpo = (await resp.json()) as Pagina<T>;
      itens.push(...(corpo.itens ?? []));
      if (pagina >= (corpo.quantidadeDePaginas ?? 1)) break;
    }
    return itens;
  }
}
