import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirProfessor } from "@/lib/auth";
import { formatarDataHora, hojeEmBrasilia } from "@/lib/datas";
import { rotuloPeriodo, semanaDe, type Periodo } from "@/lib/planejamento";
import { excluirPlanejamento, salvarPlanejamento } from "./actions";

type Planejamento = {
  id: string;
  periodo: Periodo;
  inicio: string;
  fim: string;
  objetivos: string | null;
  texto: string;
  metodologia: string | null;
  recursos: string | null;
  avaliacao: string | null;
  comentario_coordenacao: string | null;
  visto_em: string | null;
};

const CAMPOS = [
  { nome: "objetivos", rotulo: "Objetivos", dica: "O que os alunos devem aprender", linhas: 3 },
  { nome: "texto", rotulo: "Conteúdos *", dica: "Temas, capítulos, páginas", linhas: 4 },
  { nome: "metodologia", rotulo: "Metodologia", dica: "Como as aulas vão acontecer (atividades, dinâmicas)", linhas: 3 },
  { nome: "recursos", rotulo: "Recursos", dica: "Livro, materiais, vídeos, laboratório", linhas: 2 },
  { nome: "avaliacao", rotulo: "Avaliação", dica: "Como vai acompanhar o aprendizado", linhas: 2 },
] as const;

export default async function PaginaPlanejamento({ searchParams }: PageProps<"/professor/planejamento">) {
  const { supabase, professor } = await exigirProfessor();
  const p = await searchParams;
  const turmaId = Number(p.turma);
  const disciplinaId = Number(p.disciplina);
  const id = typeof p.id === "string" && /^[0-9a-f-]{36}$/.test(p.id) ? p.id : null;
  if (!Number.isInteger(turmaId) || !Number.isInteger(disciplinaId)) return <p className="text-sm text-vinho">Turma inválida.</p>;

  const letivo = await anoEmUso(supabase);
  const [{ data: vinculos }, { data: existente }] = await Promise.all([
    supabase
      .from("turma_disciplinas")
      .select("turma_id,turmas(nome,ano,ativa),disciplinas(nome)")
      .eq("professor_id", professor.id)
      .eq("disciplina_id", disciplinaId)
      .overrideTypes<{ turma_id: number; turmas: { nome: string; ano: number; ativa: boolean } | null; disciplinas: { nome: string } | null }[], { merge: false }>(),
    id
      ? supabase
          .from("planejamentos")
          .select("id,periodo,inicio,fim,objetivos,texto,metodologia,recursos,avaliacao,comentario_coordenacao,visto_em")
          .eq("id", id)
          .maybeSingle()
          .overrideTypes<Planejamento | null, { merge: false }>()
      : Promise.resolve({ data: null }),
  ]);
  const minhas = (vinculos ?? []).filter((v) => v.turmas?.ativa && v.turmas.ano === letivo.ano);
  const desta = minhas.find((v) => v.turma_id === turmaId);
  if (!desta) return <p className="text-sm text-vinho">Esta turma/disciplina não está vinculada a você.</p>;
  const outras = minhas.filter((v) => v.turma_id !== turmaId);

  const plano = existente as Planejamento | null;
  const tipo: Periodo = plano?.periodo ?? (p.periodo === "mensal" ? "mensal" : "semanal");
  const hoje = hojeEmBrasilia();
  const semana = plano?.periodo === "semanal" ? plano.inicio : semanaDe(hoje).inicio;
  const mes = (plano?.periodo === "mensal" ? plano.inicio : hoje).slice(0, 7);
  const volta = `/professor/turma?turma=${turmaId}&disciplina=${disciplinaId}&aba=planejamento`;

  return (
    <div className="space-y-4 pb-10">
      <Link href={volta} className="text-sm text-verde-claro">
        ‹ Voltar
      </Link>
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-dourado">{plano ? "EDITAR PLANEJAMENTO" : "NOVO PLANEJAMENTO"}</p>
        <h1 className="font-titulo text-2xl leading-tight text-verde-escuro">{desta.disciplinas?.nome}</h1>
        <p className="text-sm text-texto-suave">{desta.turmas?.nome}</p>
      </div>

      {plano?.visto_em && (
        <p className="rounded-md border border-verde-claro/30 bg-verde-claro/10 px-3 py-2 text-sm text-verde-escuro">
          Visto pela coordenação em {formatarDataHora(plano.visto_em)}. Se você alterar, o visto é retirado até a nova leitura.
        </p>
      )}
      {plano?.comentario_coordenacao && (
        <div className="rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          <p className="text-[11px] font-bold tracking-wider text-dourado">COMENTÁRIO DA COORDENAÇÃO</p>
          <p className="whitespace-pre-line">{plano.comentario_coordenacao}</p>
        </div>
      )}

      <form action={salvarPlanejamento} className="space-y-4">
        <input type="hidden" name="turma_id" value={turmaId} />
        <input type="hidden" name="disciplina_id" value={disciplinaId} />
        {plano && <input type="hidden" name="id" value={plano.id} />}

        <fieldset className="grid gap-3 rounded-xl border border-borda bg-white p-3 sm:grid-cols-2">
          <legend className="rotulo px-1">Período</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="periodo" value="semanal" defaultChecked={tipo === "semanal"} className="mt-3" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-verde-escuro">Semanal</span>
              <input type="date" name="semana" defaultValue={semana} className="campo mt-1" aria-label="Um dia da semana" />
              <span className="mt-0.5 block text-xs text-texto-suave">Qualquer dia da semana (vale de segunda a sábado).</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="periodo" value="mensal" defaultChecked={tipo === "mensal"} className="mt-3" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-verde-escuro">Mensal</span>
              <input type="month" name="mes" defaultValue={mes} className="campo mt-1" aria-label="Mês" />
            </span>
          </label>
        </fieldset>

        {CAMPOS.map((c) => (
          <label key={c.nome} className="block">
            <span className="rotulo">{c.rotulo}</span>
            <textarea
              name={c.nome}
              rows={c.linhas}
              maxLength={6000}
              required={c.nome === "texto"}
              defaultValue={plano ? ((plano[c.nome] as string | null) ?? "") : ""}
              placeholder={c.dica}
              className="campo"
            />
          </label>
        ))}

        {!plano && outras.length > 0 && (
          <fieldset className="rounded-xl border border-borda bg-white p-3">
            <legend className="rotulo px-1">Salvar também em</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {outras.map((o) => (
                <label key={o.turma_id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="copiar_para" value={o.turma_id} />
                  {o.turmas?.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button className="botao-primario w-full !py-3.5 sm:w-auto">Salvar planejamento</button>
      </form>

      {plano && (
        <form action={excluirPlanejamento} className="pt-2">
          <input type="hidden" name="id" value={plano.id} />
          <input type="hidden" name="turma_id" value={turmaId} />
          <input type="hidden" name="disciplina_id" value={disciplinaId} />
          <p className="text-xs text-texto-suave">{rotuloPeriodo(plano.periodo, plano.inicio, plano.fim)}</p>
          <button className="text-sm text-vinho underline-offset-4 hover:underline">Excluir este planejamento</button>
        </form>
      )}
    </div>
  );
}
