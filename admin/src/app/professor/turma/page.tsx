import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirProfessor } from "@/lib/auth";
import { formatarDataCurta } from "@/lib/datas";
import { lerTudo } from "@/lib/ler-tudo";

type Aula = {
  id: string;
  data: string;
  aula_numero: number;
  conteudo: string | null;
  tarefa: string | null;
  tarefa_entrega: string | null;
  frequencias: { status: string }[];
};
type Frequencia = { aluno_codigo: string; status: string; aulas: { turma_id: number; disciplina_id: number; data: string } };

const FREQUENCIA_MINIMA = 75;

export default async function PaginaTurma({ searchParams }: PageProps<"/professor/turma">) {
  const { supabase, professor } = await exigirProfessor();
  const p = await searchParams;
  const turmaId = Number(p.turma);
  const disciplinaId = Number(p.disciplina);
  const aba = p.aba === "alunos" ? "alunos" : "aulas";
  if (!Number.isInteger(turmaId) || !Number.isInteger(disciplinaId)) {
    return <p className="text-sm text-vinho">Turma inválida.</p>;
  }

  const { data: vinculo } = await supabase
    .from("turma_disciplinas")
    .select("turmas(nome,ano),disciplinas(nome)")
    .eq("turma_id", turmaId)
    .eq("disciplina_id", disciplinaId)
    .eq("professor_id", professor.id)
    .maybeSingle()
    .overrideTypes<{ turmas: { nome: string; ano: number } | null; disciplinas: { nome: string } | null } | null, { merge: false }>();
  if (!vinculo) return <p className="text-sm text-vinho">Esta turma/disciplina não está vinculada a você.</p>;

  const letivo = await anoEmUso(supabase);
  const ano = vinculo.turmas?.ano ?? letivo.ano;
  const base = `/professor/turma?turma=${turmaId}&disciplina=${disciplinaId}`;

  return (
    <div className="space-y-4">
      <Link href="/professor/turmas" className="text-sm text-verde-claro">
        ‹ Minhas turmas
      </Link>
      <div>
        <h1 className="font-titulo text-2xl leading-tight text-verde-escuro">{vinculo.disciplinas?.nome}</h1>
        <p className="text-sm text-texto-suave">{vinculo.turmas?.nome}</p>
      </div>
      <nav className="flex gap-2" aria-label="Seções">
        <Link href={base} className={aba === "aulas" ? "botao-primario !px-4 !py-2" : "botao-secundario !px-4 !py-2"}>
          Aulas
        </Link>
        <Link href={`${base}&aba=alunos`} className={aba === "alunos" ? "botao-primario !px-4 !py-2" : "botao-secundario !px-4 !py-2"}>
          Alunos e frequência
        </Link>
      </nav>
      {aba === "aulas" ? (
        <Aulas turmaId={turmaId} disciplinaId={disciplinaId} ano={ano} volta={base} supabase={supabase} />
      ) : (
        <Alunos turmaId={turmaId} disciplinaId={disciplinaId} ano={ano} supabase={supabase} />
      )}
    </div>
  );
}

type Cliente = Awaited<ReturnType<typeof exigirProfessor>>["supabase"];

async function Aulas({ turmaId, disciplinaId, ano, volta, supabase }: { turmaId: number; disciplinaId: number; ano: number; volta: string; supabase: Cliente }) {
  const aulas = await lerTudo<Aula>((de, ate) =>
    supabase
      .from("aulas")
      .select("id,data,aula_numero,conteudo,tarefa,tarefa_entrega,frequencias(status)")
      .eq("turma_id", turmaId)
      .eq("disciplina_id", disciplinaId)
      .gte("data", `${ano}-01-01`)
      .lte("data", `${ano}-12-31`)
      .order("data", { ascending: false })
      .order("aula_numero")
      .range(de, ate),
  );
  if (aulas.length === 0) {
    return <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhuma aula lançada ainda.</p>;
  }
  const editar = (a: Aula) =>
    `/professor/aula?turma=${turmaId}&disciplina=${disciplinaId}&data=${a.data}&aula=${a.aula_numero}&volta=${encodeURIComponent(volta)}`;

  return (
    <>
      <p className="text-xs text-texto-suave">
        {aulas.length} aula{aulas.length === 1 ? "" : "s"} lançada{aulas.length === 1 ? "" : "s"} em {ano}. Toque para ver ou corrigir.
      </p>
      <ul className="space-y-2">
        {aulas.map((a) => {
          const ausentes = a.frequencias.filter((f) => f.status !== "presente").length;
          return (
            <li key={a.id}>
              <Link href={editar(a)} className="block rounded-xl border border-borda bg-white p-3 active:bg-creme">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold capitalize text-verde-escuro">
                    {formatarDataCurta(a.data)} · {a.aula_numero}ª aula
                  </span>
                  <span className={`text-xs ${ausentes ? "text-vinho" : "text-texto-suave"}`}>
                    {a.frequencias.length ? `${ausentes} ausente${ausentes === 1 ? "" : "s"}` : "sem chamada"}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-sm text-texto">{a.conteudo}</span>
                {a.tarefa && (
                  <span className="mt-1 block text-xs text-texto-suave">
                    Tarefa{a.tarefa_entrega ? ` (para ${formatarDataCurta(a.tarefa_entrega)})` : ""}: {a.tarefa}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

async function Alunos({ turmaId, disciplinaId, ano, supabase }: { turmaId: number; disciplinaId: number; ano: number; supabase: Cliente }) {
  const [{ data: matriculas }, frequencias] = await Promise.all([
    supabase
      .from("matriculas")
      .select("aluno_codigo,numero_chamada,alunos(nome)")
      .eq("turma_id", turmaId)
      .eq("ativa", true)
      .overrideTypes<{ aluno_codigo: string; numero_chamada: number | null; alunos: { nome: string } | null }[], { merge: false }>(),
    lerTudo<Frequencia>((de, ate) =>
      supabase
        .from("frequencias")
        .select("aluno_codigo,status,aulas!inner(turma_id,disciplina_id,data)")
        .eq("aulas.turma_id", turmaId)
        .eq("aulas.disciplina_id", disciplinaId)
        .gte("aulas.data", `${ano}-01-01`)
        .lte("aulas.data", `${ano}-12-31`)
        .order("aula_id")
        .order("aluno_codigo")
        .range(de, ate)
        .overrideTypes<Frequencia[], { merge: false }>(),
    ),
  ]);

  const porAluno = new Map<string, { aulas: number; faltas: number; justificadas: number }>();
  for (const f of frequencias) {
    const r = porAluno.get(f.aluno_codigo) ?? { aulas: 0, faltas: 0, justificadas: 0 };
    r.aulas++;
    if (f.status === "falta") r.faltas++;
    if (f.status === "falta_justificada") r.justificadas++;
    porAluno.set(f.aluno_codigo, r);
  }
  const alunos = (matriculas ?? [])
    .map((m) => {
      const r = porAluno.get(m.aluno_codigo) ?? { aulas: 0, faltas: 0, justificadas: 0 };
      // Falta justificada também conta como ausência; abono é decisão da coordenação.
      const pct = r.aulas ? Math.round(((r.aulas - r.faltas - r.justificadas) / r.aulas) * 100) : null;
      return { codigo: m.aluno_codigo, nome: m.alunos?.nome ?? `Aluno ${m.aluno_codigo}`, numero: m.numero_chamada, ...r, pct };
    })
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, "pt-BR"));
  const abaixo = alunos.filter((a) => a.pct !== null && a.pct < FREQUENCIA_MINIMA).length;

  return (
    <>
      <p className="text-xs text-texto-suave">
        {alunos.length} aluno{alunos.length === 1 ? "" : "s"}. Frequência nesta disciplina em {ano}; falta justificada conta como
        ausência (abono é com a coordenação).
        {abaixo > 0 && <strong className="text-vinho"> {abaixo} abaixo de {FREQUENCIA_MINIMA}%.</strong>}
      </p>
      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
        {alunos.map((a) => (
          <li key={a.codigo} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 text-right text-xs text-texto-suave">{a.numero ?? ""}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-texto">{a.nome}</span>
              <span className="block text-xs text-texto-suave">
                {a.faltas} falta{a.faltas === 1 ? "" : "s"}
                {a.justificadas ? ` · ${a.justificadas} justificada${a.justificadas === 1 ? "" : "s"}` : ""} em {a.aulas} aula{a.aulas === 1 ? "" : "s"}
              </span>
            </span>
            <span
              className={`w-14 rounded-md py-1 text-center text-sm font-bold ${
                a.pct === null ? "text-texto-suave" : a.pct < FREQUENCIA_MINIMA ? "bg-vinho text-white" : "bg-verde-claro/15 text-verde-claro"
              }`}
            >
              {a.pct === null ? "—" : `${a.pct}%`}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
