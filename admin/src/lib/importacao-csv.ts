import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarCpf } from "./cpf";
import { chaveColuna, decodificar, lerCsv } from "./csv";
import { dataMhund } from "./importacao-cadastro";
import { lerTudo } from "./ler-tudo";

// Importação dos CSVs montados a partir da Mhund (modelos em /importacao). Mesma regra da sincronização:
// só PREENCHE campos vazios; o que a secretaria já digitou no painel não muda.

export const MODELOS = {
  alunos: {
    titulo: "Alunos",
    colunas: ["codigo_aluno", "nome_social", "sexo", "nascimento", "cpf", "rg", "naturalidade", "nacionalidade", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"],
    exemplo: ["EXEMPLO-APAGUE-ESTA-LINHA", "", "F", "10/03/2015", "123.456.789-00", "12.345.678-9", "São Paulo/SP", "Brasileira", "01310-100", "Avenida Paulista", "1000", "Apto 12", "Bela Vista", "São Paulo", "SP"],
  },
  responsaveis: {
    titulo: "Pais e responsáveis",
    colunas: ["id_responsavel", "cpf", "nome_social", "rg", "estado_civil", "naturalidade", "nacionalidade"],
    exemplo: ["EXEMPLO-APAGUE-ESTA-LINHA", "123.456.789-00", "", "98.765.432-1", "Casado(a)", "Campinas/SP", "Brasileira"],
  },
} as const;
export type TipoImportacao = keyof typeof MODELOS;

export type ResultadoImportacao = {
  gravado: boolean;
  linhas: number;
  atualizados: number;
  camposPreenchidos: number;
  semMudanca: number;
  problemas: string[];
  erro?: string;
};

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const limpo = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

const ESTADOS: [RegExp, string][] = [
  [/^solteir/, "solteiro"],
  [/^casad/, "casado"],
  [/^uniao|^uniao estavel|estavel/, "uniao_estavel"],
  [/^divorc/, "divorciado"],
  [/^separad/, "separado"],
  [/^viuv/, "viuvo"],
];
function estadoCivil(v: string) {
  const s = chaveColuna(v).replace(/_/g, " ");
  return ESTADOS.find(([re]) => re.test(s))?.[1] ?? null;
}
function sexo(v: string) {
  const s = chaveColuna(v);
  return /^(f|fem)/.test(s) ? "F" : /^(m|masc)/.test(s) ? "M" : null;
}

function tabela(bytes: ArrayBuffer, tipo: TipoImportacao) {
  const linhas = lerCsv(decodificar(bytes));
  if (linhas.length < 2) return { erro: "O arquivo está vazio ou só tem o cabeçalho." } as const;
  const cab = linhas[0].map(chaveColuna);
  const chave = tipo === "alunos" ? ["codigo_aluno"] : ["id_responsavel", "cpf"];
  if (!chave.some((c) => cab.includes(c))) {
    return { erro: `Falta a coluna ${chave.join(" ou ")}. Baixe o modelo e use os mesmos nomes de coluna.` } as const;
  }
  const desconhecidas = cab.filter((c) => c && !(MODELOS[tipo].colunas as readonly string[]).includes(c));
  const registros = linhas.slice(1).map((l, i) => ({ n: i + 2, v: Object.fromEntries(cab.map((c, j) => [c, limpo(l[j])])) as Record<string, string> }));
  return { registros, desconhecidas } as const;
}

export async function importarCsv(db: SupabaseClient, tipo: TipoImportacao, bytes: ArrayBuffer, gravar: boolean): Promise<ResultadoImportacao> {
  const r: ResultadoImportacao = { gravado: gravar, linhas: 0, atualizados: 0, camposPreenchidos: 0, semMudanca: 0, problemas: [] };
  const t = tabela(bytes, tipo);
  if ("erro" in t) return { ...r, erro: t.erro };
  r.linhas = t.registros.length;
  if (t.desconhecidas.length) r.problemas.push(`Colunas ignoradas (não estão no modelo): ${t.desconhecidas.join(", ")}.`);
  const problema = (n: number, msg: string) => r.problemas.length < 60 && r.problemas.push(`Linha ${n}: ${msg}`);
  return tipo === "alunos" ? importarAlunos(db, t.registros, gravar, r, problema) : importarResponsaveis(db, t.registros, gravar, r, problema);
}

type Registro = { n: number; v: Record<string, string> };

async function importarAlunos(db: SupabaseClient, registros: Registro[], gravar: boolean, r: ResultadoImportacao, problema: (n: number, m: string) => void) {
  const [alunos, dados] = await Promise.all([
    lerTudo<{ codigo: string }>((de, ate) => db.from("alunos").select("codigo").order("codigo").range(de, ate)),
    lerTudo<Record<string, string | null> & { aluno_codigo: string }>((de, ate) => db.from("aluno_dados").select("*").order("aluno_codigo").range(de, ate)),
  ]);
  const existe = new Set(alunos.map((a) => a.codigo));
  const atual = new Map(dados.map((d) => [d.aluno_codigo, d]));
  const cpfUsado = new Map(dados.filter((d) => d.cpf).map((d) => [d.cpf as string, d.aluno_codigo]));
  const linhas: Record<string, unknown>[] = [];

  for (const { n, v } of registros) {
    const codigo = v.codigo_aluno?.replace(/\.0+$/, "");
    if (!codigo) {
      problema(n, "sem código do aluno.");
      continue;
    }
    if (!existe.has(codigo)) {
      problema(n, `aluno ${codigo} não existe no painel.`);
      continue;
    }
    const novo: Record<string, string | null> = {};
    if (v.cpf) {
      const cpf = normalizarCpf(v.cpf);
      if (!cpf) problema(n, `CPF inválido (${v.cpf}).`);
      else if (cpfUsado.has(cpf) && cpfUsado.get(cpf) !== codigo) problema(n, `CPF já é de outro aluno (${cpfUsado.get(cpf)}).`);
      else novo.cpf = cpf;
    }
    if (v.cep) {
      const cep = v.cep.replace(/\D/g, "").padStart(8, "0");
      if (cep.length === 8) novo.cep = cep;
      else problema(n, `CEP inválido (${v.cep}).`);
    }
    if (v.uf) {
      if (/^[A-Za-z]{2}$/.test(v.uf)) novo.uf = v.uf.toUpperCase();
      else problema(n, `UF inválida (${v.uf}).`);
    }
    if (v.nascimento) {
      const d = dataMhund(v.nascimento);
      if (d) novo.nascimento = d;
      else problema(n, `data de nascimento inválida (${v.nascimento}).`);
    }
    if (v.sexo) {
      const s = sexo(v.sexo);
      if (s) novo.sexo = s;
      else problema(n, `sexo deve ser M ou F (${v.sexo}).`);
    }
    for (const c of ["nome_social", "rg", "naturalidade", "logradouro", "numero", "complemento", "bairro", "cidade"]) if (v[c]) novo[c] = v[c];

    const antes = atual.get(codigo);
    const base: Record<string, unknown> = { ...(antes ?? {}), aluno_codigo: codigo };
    let preenchidos = 0;
    for (const [k, val] of Object.entries(novo)) {
      if (vazio(base[k])) {
        base[k] = val;
        preenchidos++;
      }
    }
    // Nacionalidade nasce "Brasileira" (padrão): o CSV só a troca se vier outra.
    if (v.nacionalidade && (!antes || antes.nacionalidade === "Brasileira") && v.nacionalidade !== "Brasileira") {
      base.nacionalidade = v.nacionalidade;
      preenchidos++;
    }
    if (preenchidos === 0) {
      r.semMudanca++;
      continue;
    }
    if (novo.cpf) cpfUsado.set(novo.cpf, codigo);
    base.atualizado_em = new Date().toISOString();
    linhas.push(base);
    r.atualizados++;
    r.camposPreenchidos += preenchidos;
  }

  if (gravar) {
    // Linhas completas (o que já havia + o que faltava): o upsert em lote não apaga nada.
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await db.from("aluno_dados").upsert(linhas.slice(i, i + 200), { onConflict: "aluno_codigo" });
      if (error) return { ...r, erro: `Gravou ${i} aluno(s) e parou: ${error.message}` };
    }
  }
  return r;
}

async function importarResponsaveis(db: SupabaseClient, registros: Registro[], gravar: boolean, r: ResultadoImportacao, problema: (n: number, m: string) => void) {
  type Pessoa = { id: number; mhund_id: number | null; cpf: string | null; nome_social: string | null; rg: string | null; estado_civil: string | null; naturalidade: string | null; nacionalidade: string };
  const pessoas = await lerTudo<Pessoa>((de, ate) =>
    db.from("responsaveis").select("id,mhund_id,cpf,nome_social,rg,estado_civil,naturalidade,nacionalidade").order("id").range(de, ate),
  );
  const porMhund = new Map(pessoas.filter((p) => p.mhund_id).map((p) => [String(p.mhund_id), p]));
  const porCpf = new Map(pessoas.filter((p) => p.cpf).map((p) => [p.cpf as string, p]));
  const mudancas: { id: number; patch: Record<string, string> }[] = [];

  for (const { n, v } of registros) {
    const id = v.id_responsavel?.replace(/\.0+$/, "");
    const cpf = v.cpf ? normalizarCpf(v.cpf) : null;
    if (v.cpf && !cpf) problema(n, `CPF inválido (${v.cpf}).`);
    const p = (id ? porMhund.get(id) : undefined) ?? (cpf ? porCpf.get(cpf) : undefined);
    if (!p) {
      problema(n, `responsável ${id ? `id ${id}` : ""}${id && cpf ? " / " : ""}${cpf ? `CPF ${v.cpf}` : ""} não encontrado (a sincronização noturna cria os responsáveis antes).`);
      continue;
    }
    const patch: Record<string, string> = {};
    if (cpf && !p.cpf && !porCpf.has(cpf)) patch.cpf = cpf;
    if (v.nome_social && !p.nome_social) patch.nome_social = v.nome_social;
    if (v.rg && !p.rg) patch.rg = v.rg;
    if (v.naturalidade && !p.naturalidade) patch.naturalidade = v.naturalidade;
    if (v.estado_civil && !p.estado_civil) {
      const e = estadoCivil(v.estado_civil);
      if (e) patch.estado_civil = e;
      else problema(n, `estado civil não reconhecido (${v.estado_civil}).`);
    }
    if (v.nacionalidade && p.nacionalidade === "Brasileira" && v.nacionalidade !== "Brasileira") patch.nacionalidade = v.nacionalidade;
    if (Object.keys(patch).length === 0) {
      r.semMudanca++;
      continue;
    }
    Object.assign(p, patch);
    if (patch.cpf) porCpf.set(patch.cpf, p);
    mudancas.push({ id: p.id, patch });
    r.atualizados++;
    r.camposPreenchidos += Object.keys(patch).length;
  }

  if (gravar) {
    for (let i = 0; i < mudancas.length; i += 10) {
      const lote = mudancas.slice(i, i + 10);
      const respostas = await Promise.all(lote.map((m) => db.from("responsaveis").update({ ...m.patch, atualizado_em: new Date().toISOString() }).eq("id", m.id)));
      const falha = respostas.find((x) => x.error);
      if (falha?.error) return { ...r, erro: `Gravou ${i} responsável(is) e parou: ${falha.error.message}` };
    }
  }
  return r;
}

/** Modelo para baixar: cabeçalho + uma linha de exemplo (dados inventados), separador ";" e BOM para o Excel. */
export function modeloCsv(tipo: TipoImportacao) {
  const m = MODELOS[tipo];
  return `﻿${m.colunas.join(";")}\r\n${m.exemplo.join(";")}\r\n`;
}
