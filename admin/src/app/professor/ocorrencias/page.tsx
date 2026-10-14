import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirProfessor } from "@/lib/auth";
import { formatarDataCurta, hojeEmBrasilia } from "@/lib/datas";
import { CAMPOS_OCORRENCIA, STATUS_OCORRENCIA, TIPOS_OCORRENCIA, type Ocorrencia } from "@/lib/ocorrencias";
import { editarOcorrenciaProfessor, excluirOcorrenciaProfessor, registrarOcorrenciaProfessor } from "./actions";

type Vinculo = { turma_id: number; disciplina_id: number; turmas: { nome: string; ano: number } | null; disciplinas: { nome: string } | null };

export default async function OcorrenciasProfessor({ searchParams }: PageProps<"/professor/ocorrencias">) {
  const { supabase, userId, professor } = await exigirProfessor();
  const p = await searchParams;
  const letivo = await anoEmUso(supabase);
  // Vem do link da lista de alunos (?turma=&disciplina=) ou do seletor desta página (?turma_disciplina=turma:disciplina).
  const [tdTurma, tdDisc] = typeof p.turma_disciplina === "string" ? p.turma_disciplina.split(":") : [];
  const turmaId = Number(p.turma ?? tdTurma) || null;
  const disciplinaId = Number(p.disciplina ?? tdDisc) || null;
  const alunoPedido = typeof p.aluno === "string" ? p.aluno : "";

  const [{ data: vinculosBrutos }, { data: minhas }] = await Promise.all([
    supabase
      .from("turma_disciplinas")
      .select("turma_id,disciplina_id,turmas(nome,ano),disciplinas(nome)")
      .eq("professor_id", professor.id)
      .overrideTypes<Vinculo[], { merge: false }>(),
    supabase
      .from("ocorrencias")
      .select(`${CAMPOS_OCORRENCIA},alunos(nome)`)
      .eq("registrado_por", userId)
      .order("criado_em", { ascending: false })
      .limit(50)
      .overrideTypes<(Ocorrencia & { alunos: { nome: string } | null })[], { merge: false }>(),
  ]);
  const vinculos = (vinculosBrutos ?? [])
    .filter((v) => v.turmas?.ano === letivo.ano)
    .sort((a, b) => (a.turmas?.nome ?? "").localeCompare(b.turmas?.nome ?? "", "pt-BR"));
  const vinculo = vinculos.find((v) => v.turma_id === turmaId && (!disciplinaId || v.disciplina_id === disciplinaId));

  const { data: alunos } = vinculo
    ? await supabase
        .from("matriculas")
        .select("aluno_codigo,numero_chamada,alunos(nome)")
        .eq("turma_id", vinculo.turma_id)
        .eq("ativa", true)
        .overrideTypes<{ aluno_codigo: string; numero_chamada: number | null; alunos: { nome: string } | null }[], { merge: false }>()
    : { data: null };
  const listaAlunos = (alunos ?? []).sort(
    (a, b) => (a.numero_chamada ?? 999) - (b.numero_chamada ?? 999) || (a.alunos?.nome ?? "").localeCompare(b.alunos?.nome ?? "", "pt-BR"),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-titulo text-2xl text-verde-escuro">Ocorrências</h1>
        <p className="text-sm text-texto-suave">
          Registre o que aconteceu com o aluno. A coordenação lê e revisa antes de enviar à família pelo app (ou guarda como registro
          interno). Escreva de forma objetiva: o texto pode chegar aos responsáveis.
        </p>
      </div>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <section className="rounded-xl border border-borda bg-white p-4">
        <form className="flex flex-wrap items-end gap-2" action="/professor/ocorrencias">
          <label className="min-w-48 flex-1">
            <span className="rotulo">Turma</span>
            <select name="turma_disciplina" defaultValue={vinculo ? `${vinculo.turma_id}:${vinculo.disciplina_id}` : ""} className="campo" required>
              <option value="" disabled>
                Escolha…
              </option>
              {vinculos.map((v) => (
                <option key={`${v.turma_id}:${v.disciplina_id}`} value={`${v.turma_id}:${v.disciplina_id}`}>
                  {v.turmas?.nome} · {v.disciplinas?.nome}
                </option>
              ))}
            </select>
          </label>
          <button className="botao-secundario">Abrir</button>
        </form>

        {vinculo && (
          <form action={registrarOcorrenciaProfessor} className="mt-4 space-y-3">
            <input type="hidden" name="turma" value={vinculo.turma_id} />
            <input type="hidden" name="disciplina" value={vinculo.disciplina_id} />
            <label className="block">
              <span className="rotulo">Aluno</span>
              <select name="aluno" defaultValue={alunoPedido} required className="campo">
                <option value="" disabled>
                  Escolha o aluno…
                </option>
                {listaAlunos.map((a) => (
                  <option key={a.aluno_codigo} value={a.aluno_codigo}>
                    {a.numero_chamada ? `${a.numero_chamada}. ` : ""}
                    {a.alunos?.nome ?? a.aluno_codigo}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="rotulo">Tipo</span>
                <select name="tipo" defaultValue="disciplinar" className="campo">
                  {Object.entries(TIPOS_OCORRENCIA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Data</span>
                <input name="data" type="date" defaultValue={hojeEmBrasilia()} max={hojeEmBrasilia()} className="campo" />
              </label>
            </div>
            <label className="block">
              <span className="rotulo">O que aconteceu</span>
              <textarea name="descricao" rows={4} required minLength={3} maxLength={4000} className="campo" />
            </label>
            <button className="botao-primario w-full">Registrar</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Registradas por você</h2>
        {(minhas ?? []).length === 0 ? (
          <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhuma ainda.</p>
        ) : (
          <ul className="space-y-3">
            {(minhas ?? []).map((o) => (
              <li key={o.id} className="rounded-xl border border-borda bg-white p-4">
                <p className="text-sm">
                  <strong className="text-verde-escuro">{o.alunos?.nome ?? o.aluno_codigo}</strong>
                  <span className="text-xs text-texto-suave">
                    {" "}
                    · {formatarDataCurta(o.data)} · {TIPOS_OCORRENCIA[o.tipo]} · {STATUS_OCORRENCIA[o.status]}
                  </span>
                </p>
                {o.status === "pendente" ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-texto">{o.descricao.slice(0, 120)}{o.descricao.length > 120 ? "…" : ""}</summary>
                    <form action={editarOcorrenciaProfessor} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={o.id} />
                      <select name="tipo" defaultValue={o.tipo} className="campo">
                        {Object.entries(TIPOS_OCORRENCIA).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <textarea name="descricao" defaultValue={o.descricao} rows={4} required minLength={3} maxLength={4000} className="campo" />
                      <button className="botao-secundario">Salvar</button>
                    </form>
                    <form action={excluirOcorrenciaProfessor} className="mt-2">
                      <input type="hidden" name="id" value={o.id} />
                      <button className="text-xs text-vinho">Excluir</button>
                    </form>
                  </details>
                ) : (
                  <p className="mt-1 whitespace-pre-line text-sm text-texto">{o.descricao}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href="/professor" className="text-sm text-verde-claro">
        ‹ Voltar
      </Link>
    </div>
  );
}
