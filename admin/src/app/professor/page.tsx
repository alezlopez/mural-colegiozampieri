import Link from "next/link";
import { exigirProfessor } from "@/lib/auth";
import { diaDaSemana, formatarDataCurta, hojeEmBrasilia, somarDias } from "@/lib/datas";

type Vinculo = { turma_id: number; disciplina_id: number; turmas: { nome: string; modelo_horario_id: number | null; ativa: boolean } | null; disciplinas: { nome: string } | null };
type Slot = { turma_id: number; dia_semana: number; aula_numero: number; disciplina_id: number };
type HorarioAula = { modelo_id: number; numero: number; inicio: string; fim: string };
type AulaLancada = { turma_id: number; disciplina_id: number; aula_numero: number; conteudo: string | null };

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

export default async function Hoje({ searchParams }: PageProps<"/professor">) {
  const { supabase, professor } = await exigirProfessor();
  const { data: bruta, salvo } = await searchParams;
  const data = typeof bruta === "string" && DATA_VALIDA.test(bruta) ? bruta : hojeEmBrasilia();
  const dia = diaDaSemana(data);

  const { data: vinculosBrutos } = await supabase
    .from("turma_disciplinas")
    .select("turma_id,disciplina_id,turmas(nome,modelo_horario_id,ativa),disciplinas(nome)")
    .eq("professor_id", professor.id)
    .overrideTypes<Vinculo[], { merge: false }>();
  const vinculos = (vinculosBrutos ?? []).filter((v) => v.turmas?.ativa);
  const turmaIds = [...new Set(vinculos.map((v) => v.turma_id))];

  const [{ data: slots }, { data: horarios }, { data: lancadas }] = await Promise.all([
    supabase.from("turma_horario").select("turma_id,dia_semana,aula_numero,disciplina_id").in("turma_id", turmaIds).eq("dia_semana", dia),
    supabase.from("modelo_horario_aulas").select("modelo_id,numero,inicio,fim"),
    supabase.from("aulas").select("turma_id,disciplina_id,aula_numero,conteudo").in("turma_id", turmaIds).eq("data", data),
  ]);
  const meus = new Set(vinculos.map((v) => `${v.turma_id}:${v.disciplina_id}`));
  const nome = new Map(vinculos.map((v) => [`${v.turma_id}:${v.disciplina_id}`, v]));
  const hora = (modelo: number | null | undefined, numero: number) =>
    (horarios as HorarioAula[] | null)?.find((h) => h.modelo_id === modelo && h.numero === numero);
  const feita = (t: number, d: number, n: number) =>
    (lancadas as AulaLancada[] | null)?.some((a) => a.turma_id === t && a.disciplina_id === d && a.aula_numero === n && a.conteudo);

  // Com horário semanal cadastrado: as aulas do dia em ordem. Sem horário: todas as turmas/disciplinas do professor.
  const doDia = ((slots as Slot[] | null) ?? [])
    .filter((s) => meus.has(`${s.turma_id}:${s.disciplina_id}`))
    .map((s) => {
      const v = nome.get(`${s.turma_id}:${s.disciplina_id}`)!;
      return { ...s, turma: v.turmas!.nome, disciplina: v.disciplinas?.nome ?? "", h: hora(v.turmas!.modelo_horario_id, s.aula_numero) };
    })
    .sort((a, b) => (a.h?.inicio ?? "").localeCompare(b.h?.inicio ?? "") || a.aula_numero - b.aula_numero);

  const ehFimDeSemana = dia >= 6;
  const link = (turma: number, disciplina: number, aula: number) =>
    `/professor/aula?turma=${turma}&disciplina=${disciplina}&data=${data}&aula=${aula}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/professor?data=${somarDias(data, -1)}`} className="botao-secundario !px-3" aria-label="Dia anterior">
          ‹
        </Link>
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] text-dourado">{data === hojeEmBrasilia() ? "HOJE" : "DIA"}</p>
          <p className="font-titulo text-2xl capitalize text-verde-escuro">{formatarDataCurta(data)}</p>
        </div>
        <Link href={`/professor?data=${somarDias(data, 1)}`} className="botao-secundario !px-3" aria-label="Próximo dia">
          ›
        </Link>
      </div>

      {salvo && (
        <p role="status" className="rounded-md border border-verde-claro/30 bg-verde-claro/10 px-3 py-2 text-sm text-verde-escuro">
          Aula e chamada salvas.
        </p>
      )}

      {vinculos.length === 0 && (
        <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">
          Nenhuma turma vinculada a você ainda. Os vínculos vêm da grade da Mhund; fale com a secretaria.
        </p>
      )}

      {doDia.length > 0 ? (
        <ul className="space-y-2">
          {doDia.map((a) => (
            <li key={`${a.turma_id}-${a.aula_numero}`}>
              <Link
                href={link(a.turma_id, a.disciplina_id, a.aula_numero)}
                className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 active:bg-creme"
              >
                <span className="w-14 shrink-0 text-center">
                  <span className="block text-xs font-bold text-texto-suave">{a.aula_numero}ª aula</span>
                  <span className="block text-sm text-texto">{a.h?.inicio.slice(0, 5) ?? ""}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-titulo text-lg leading-tight text-verde-escuro">{a.disciplina}</span>
                  <span className="block truncate text-sm text-texto-suave">{a.turma}</span>
                </span>
                <span className={`text-xs font-bold ${feita(a.turma_id, a.disciplina_id, a.aula_numero) ? "text-verde-claro" : "text-dourado"}`}>
                  {feita(a.turma_id, a.disciplina_id, a.aula_numero) ? "LANÇADA ✓" : "LANÇAR ›"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        vinculos.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-texto-suave">
              {ehFimDeSemana
                ? "Fim de semana. Para lançar uma aula deste dia (ex.: sábado letivo), escolha a turma:"
                : "O horário semanal ainda não foi cadastrado. Escolha a turma e a disciplina para lançar:"}
            </p>
            <ul className="space-y-2">
              {vinculos.map((v) => (
                <li key={`${v.turma_id}-${v.disciplina_id}`}>
                  <Link
                    href={link(v.turma_id, v.disciplina_id, 1)}
                    className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 active:bg-creme"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-titulo text-lg leading-tight text-verde-escuro">{v.disciplinas?.nome}</span>
                      <span className="block truncate text-sm text-texto-suave">{v.turmas?.nome}</span>
                    </span>
                    <span className={`text-xs font-bold ${feita(v.turma_id, v.disciplina_id, 1) ? "text-verde-claro" : "text-dourado"}`}>
                      {feita(v.turma_id, v.disciplina_id, 1) ? "LANÇADA ✓" : "LANÇAR ›"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
