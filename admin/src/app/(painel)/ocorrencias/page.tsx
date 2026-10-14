import type { Route } from "next";
import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirArea } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { lerTudo } from "@/lib/ler-tudo";
import { CAMPOS_OCORRENCIA, TIPOS_OCORRENCIA, type Ocorrencia } from "@/lib/ocorrencias";
import { registrarOcorrencia } from "./actions";
import { CartaoOcorrencia } from "./CartaoOcorrencia";

const FILTROS = { revisar: "Aguardando revisão", ciencia: "Ciência pendente", todas: "Todas" } as const;

export default async function PaginaOcorrencias({ searchParams }: PageProps<"/ocorrencias">) {
  const { supabase, podeEditar } = await exigirArea("acompanhamento");
  const p = await searchParams;
  const { ano } = await anoEmUso(supabase);
  const turmaId = Number(p.turma) || null;
  const alunoFiltro = typeof p.aluno === "string" ? p.aluno : null;

  const [{ count: pendentes }, { count: semCiencia }] = await Promise.all([
    supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("ano", ano).eq("status", "pendente"),
    supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("ano", ano).eq("status", "publicada").eq("exige_ciencia", true).is("ciencia_em", null),
  ]);
  const filtro = (typeof p.filtro === "string" && p.filtro in FILTROS ? p.filtro : pendentes ? "revisar" : "todas") as keyof typeof FILTROS;

  let consulta = supabase.from("ocorrencias").select(`${CAMPOS_OCORRENCIA},alunos(nome)`).eq("ano", ano);
  if (filtro === "revisar") consulta = consulta.eq("status", "pendente");
  if (filtro === "ciencia") consulta = consulta.eq("status", "publicada").eq("exige_ciencia", true).is("ciencia_em", null);
  if (turmaId) consulta = consulta.eq("turma_id", turmaId);
  if (alunoFiltro) consulta = consulta.eq("aluno_codigo", alunoFiltro);
  const [{ data: ocorrencias }, { data: turmas }, { data: disciplinas }, matriculas] = await Promise.all([
    consulta
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(200)
      .overrideTypes<(Ocorrencia & { alunos: { nome: string } | null })[], { merge: false }>(),
    supabase.from("turmas").select("id,nome").eq("ano", ano).order("nome"),
    supabase.from("disciplinas").select("id,nome"),
    lerTudo<{ aluno_codigo: string; alunos: { nome: string } | null; turmas: { nome: string } | null }>((de, ate) =>
      supabase
        .from("matriculas")
        .select("aluno_codigo,alunos(nome),turmas(nome)")
        .eq("ano", ano)
        .eq("ativa", true)
        .order("aluno_codigo")
        .order("turma_id")
        .range(de, ate)
        .overrideTypes<{ aluno_codigo: string; alunos: { nome: string } | null; turmas: { nome: string } | null }[], { merge: false }>(),
    ),
  ]);
  const nomeTurma = new Map((turmas ?? []).map((t) => [t.id as number, t.nome as string]));
  const nomeDisc = new Map((disciplinas ?? []).map((d) => [d.id as number, d.nome as string]));
  const sugestoes = matriculas
    .map((m) => `${m.alunos?.nome ?? "?"} · ${m.turmas?.nome ?? "?"} · código ${m.aluno_codigo}`)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const alunoPrefixado = alunoFiltro ? sugestoes.find((s) => s.endsWith(`código ${alunoFiltro}`)) ?? alunoFiltro : "";

  const url = (mudar: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ filtro, turma: turmaId, aluno: alunoFiltro, ...mudar })) if (v !== null) q.set(k, String(v));
    return `/ocorrencias?${q}` as Route;
  };
  const volta = url({});

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Ocorrências {ano}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Registradas pela coordenação ou pelos professores. As dos professores esperam a sua revisão antes de chegar à família. Enviada à
        família = aparece no app e o responsável recebe um aviso; interna = só a escola vê.
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      {podeEditar && (
        <details id="nova" className="mt-6 rounded-xl border border-borda bg-white p-4" open={Boolean(alunoFiltro)}>
          <summary className="cursor-pointer font-bold text-verde-escuro">+ Registrar ocorrência</summary>
          <form action={registrarOcorrencia} className="mt-4 space-y-3">
            <input type="hidden" name="volta" value={volta} />
            <div className="grid gap-3 sm:grid-cols-[2fr_auto_auto]">
              <label className="block">
                <span className="rotulo">Aluno</span>
                <input name="aluno" list="alunos-ano" defaultValue={alunoPrefixado} required placeholder="Digite o nome ou o código" className="campo" autoComplete="off" />
                <datalist id="alunos-ano">
                  {sugestoes.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="rotulo">Data</span>
                <input name="data" type="date" defaultValue={hojeEmBrasilia()} max={hojeEmBrasilia()} className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Tipo</span>
                <select name="tipo" defaultValue="disciplinar" className="campo">
                  {Object.entries(TIPOS_OCORRENCIA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="rotulo">Descrição (a família lê este texto)</span>
              <textarea name="descricao" rows={4} required minLength={3} maxLength={4000} className="campo" />
            </label>
            <label className="block">
              <span className="rotulo">Providência tomada (opcional)</span>
              <textarea name="providencia" rows={2} maxLength={2000} className="campo" placeholder="Ex.: conversa com o aluno; contato com a família" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="exige_ciencia" />
                Pedir ciência do responsável (ocorrências graves)
              </label>
              <span className="flex-1" />
              <button name="destino" value="interna" className="botao-secundario">
                Salvar como interna
              </button>
              <button name="destino" value="publicada" className="botao-primario">
                Enviar à família
              </button>
            </div>
          </form>
        </details>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(FILTROS).map(([k, r]) => (
          <Link key={k} href={url({ filtro: k })} className={k === filtro ? "botao-primario !px-3 !py-1.5" : "botao-secundario !px-3 !py-1.5"}>
            {r}
            {k === "revisar" && pendentes ? ` (${pendentes})` : ""}
            {k === "ciencia" && semCiencia ? ` (${semCiencia})` : ""}
          </Link>
        ))}
        {alunoFiltro && (
          <Link href={url({ aluno: null })} className="text-xs text-verde-claro underline">
            ver de todos os alunos
          </Link>
        )}
        <form className="ml-auto flex items-center gap-2" action="/ocorrencias">
          <input type="hidden" name="filtro" value={filtro} />
          <select name="turma" defaultValue={turmaId ?? ""} className="campo !w-auto !py-1.5" aria-label="Turma">
            <option value="">Todas as turmas</option>
            {(turmas ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <button className="botao-secundario !px-3 !py-1.5">Filtrar</button>
        </form>
      </div>

      {(ocorrencias ?? []).length === 0 ? (
        <p className="mt-4 rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">Nenhuma ocorrência aqui.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(ocorrencias ?? []).map((o) => (
            <CartaoOcorrencia
              key={o.id}
              o={o}
              aluno={o.alunos?.nome ?? o.aluno_codigo}
              turma={o.turma_id ? nomeTurma.get(o.turma_id) : null}
              disciplina={o.disciplina_id ? nomeDisc.get(o.disciplina_id) : null}
              volta={volta}
              podeEditar={podeEditar}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
