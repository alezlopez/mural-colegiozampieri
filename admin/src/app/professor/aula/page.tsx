import Link from "next/link";
import { exigirProfessor } from "@/lib/auth";
import { formatarDataCurta } from "@/lib/datas";
import { FormAula } from "./FormAula";

type Status = "presente" | "falta" | "falta_justificada";

export default async function PaginaAula({ searchParams }: PageProps<"/professor/aula">) {
  const { supabase, professor } = await exigirProfessor();
  const p = await searchParams;
  const turmaId = Number(p.turma);
  const disciplinaId = Number(p.disciplina);
  const aulaNumero = Number(p.aula ?? 1);
  const data = typeof p.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null;
  if (![turmaId, disciplinaId, aulaNumero].every(Number.isInteger) || !data) {
    return <p className="text-sm text-vinho">Aula inválida. Volte e escolha a turma de novo.</p>;
  }

  const { data: vinculo } = await supabase
    .from("turma_disciplinas")
    .select("turmas(nome),disciplinas(nome)")
    .eq("turma_id", turmaId)
    .eq("disciplina_id", disciplinaId)
    .eq("professor_id", professor.id)
    .maybeSingle()
    .overrideTypes<{ turmas: { nome: string } | null; disciplinas: { nome: string } | null } | null, { merge: false }>();
  if (!vinculo) return <p className="text-sm text-vinho">Esta turma/disciplina não está vinculada a você.</p>;

  const [{ data: matriculas }, { data: aula }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("aluno_codigo,numero_chamada,alunos(nome)")
      .eq("turma_id", turmaId)
      .eq("ativa", true)
      .overrideTypes<{ aluno_codigo: string; numero_chamada: number | null; alunos: { nome: string } | null }[], { merge: false }>(),
    supabase
      .from("aulas")
      .select("id,conteudo,tarefa,tarefa_entrega,frequencias(aluno_codigo,status)")
      .eq("turma_id", turmaId)
      .eq("disciplina_id", disciplinaId)
      .eq("data", data)
      .eq("aula_numero", aulaNumero)
      .maybeSingle()
      .overrideTypes<
        { id: string; conteudo: string | null; tarefa: string | null; tarefa_entrega: string | null; frequencias: { aluno_codigo: string; status: Status }[] } | null,
        { merge: false }
      >(),
  ]);

  const alunos = (matriculas ?? [])
    .map((m) => ({ codigo: m.aluno_codigo, nome: m.alunos?.nome ?? `Aluno ${m.aluno_codigo}`, numero: m.numero_chamada }))
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome, "pt-BR"));
  const chamada = Object.fromEntries((aula?.frequencias ?? []).map((f) => [f.aluno_codigo, f.status]));

  return (
    <div className="space-y-4">
      <Link href={`/professor?data=${data}`} className="text-sm text-verde-claro">
        ‹ Voltar
      </Link>
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-dourado">
          {aulaNumero}ª AULA · {formatarDataCurta(data).toUpperCase()}
        </p>
        <h1 className="font-titulo text-2xl leading-tight text-verde-escuro">{vinculo.disciplinas?.nome}</h1>
        <p className="text-sm text-texto-suave">{vinculo.turmas?.nome}</p>
      </div>
      <FormAula
        turmaId={turmaId}
        disciplinaId={disciplinaId}
        aulaNumero={aulaNumero}
        data={data}
        conteudo={aula?.conteudo ?? ""}
        tarefa={aula?.tarefa ?? ""}
        entrega={aula?.tarefa_entrega ?? ""}
        alunos={alunos}
        chamada={chamada}
      />
    </div>
  );
}
