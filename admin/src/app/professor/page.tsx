import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirProfessor } from "@/lib/auth";
import { eventosDoDia, semAulaNoDia, TIPOS_EVENTO, type EventoCalendario } from "@/lib/calendario";
import { diaDaSemana, formatarDataCurta, hojeEmBrasilia, somarDias } from "@/lib/datas";

type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  turmas: { nome: string; ano: number; modelo_horario_id: number | null; ativa: boolean } | null;
  disciplinas: { nome: string } | null;
};
type Slot = { turma_id: number; dia_semana: number; aula_numero: number; disciplina_id: number };
type HorarioAula = { modelo_id: number; numero: number; inicio: string; fim: string };
type AulaLancada = { turma_id: number; disciplina_id: number; aula_numero: number; conteudo: string | null };

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

export default async function Hoje({ searchParams }: PageProps<"/professor">) {
  const { supabase, professor } = await exigirProfessor();
  const { data: bruta, salvo, todas } = await searchParams;
  const data = typeof bruta === "string" && DATA_VALIDA.test(bruta) ? bruta : hojeEmBrasilia();
  const dia = diaDaSemana(data);
  const letivo = await anoEmUso(supabase);

  const { data: vinculosBrutos } = await supabase
    .from("turma_disciplinas")
    .select("turma_id,disciplina_id,turmas(nome,ano,modelo_horario_id,ativa),disciplinas(nome)")
    .eq("professor_id", professor.id)
    .overrideTypes<Vinculo[], { merge: false }>();
  // Só as turmas do ano em uso (as de anos anteriores continuam no banco como histórico).
  const vinculos = (vinculosBrutos ?? [])
    .filter((v) => v.turmas?.ativa && v.turmas.ano === letivo.ano)
    .sort((a, b) => (a.turmas?.nome ?? "").localeCompare(b.turmas?.nome ?? "", "pt-BR", { numeric: true }));
  const turmaIds = [...new Set(vinculos.map((v) => v.turma_id))];

  const [{ data: slots }, { data: horarios }, { data: lancadas }, { data: eventosBrutos }, { count: horarioCadastrado }] = await Promise.all([
    supabase.from("turma_horario").select("turma_id,dia_semana,aula_numero,disciplina_id").in("turma_id", turmaIds).eq("dia_semana", dia),
    supabase.from("modelo_horario_aulas").select("modelo_id,numero,inicio,fim"),
    supabase.from("aulas").select("turma_id,disciplina_id,aula_numero,conteudo").in("turma_id", turmaIds).eq("data", data),
    supabase.from("calendario_eventos").select("id,inicio,fim,tipo,titulo,descricao,letivo,turmas,publico").lte("inicio", data).gte("fim", data),
    supabase.from("turma_horario").select("turma_id", { count: "exact", head: true }).in("turma_id", turmaIds),
  ]);
  const eventos = (eventosBrutos ?? []) as EventoCalendario[];
  const meus = new Map(vinculos.map((v) => [`${v.turma_id}:${v.disciplina_id}`, v]));
  const hora = (modelo: number | null | undefined, numero: number) =>
    (horarios as HorarioAula[] | null)?.find((h) => h.modelo_id === modelo && h.numero === numero);
  const lancada = (t: number, d: number, n: number) =>
    (lancadas as AulaLancada[] | null)?.some((a) => a.turma_id === t && a.disciplina_id === d && a.aula_numero === n && a.conteudo);

  const foraDoPeriodo = Boolean(letivo.inicio && letivo.fim && (data < letivo.inicio || data > letivo.fim));
  const sabadoLetivo = dia === 6 && eventosDoDia(eventos, data).some((e) => e.tipo === "sabado_letivo");
  const suspensas = new Map<number, EventoCalendario>();
  for (const t of turmaIds) {
    const e = semAulaNoDia(eventos, data, t);
    if (e) suspensas.set(t, e);
  }

  // Aulas do dia pelo horário; aulas seguidas da mesma disciplina na mesma turma viram uma só (aula dupla).
  const doDia = ((slots as Slot[] | null) ?? [])
    .filter((s) => meus.has(`${s.turma_id}:${s.disciplina_id}`) && !suspensas.has(s.turma_id))
    .map((s) => {
      const v = meus.get(`${s.turma_id}:${s.disciplina_id}`)!;
      return { ...s, turma: v.turmas!.nome, disciplina: v.disciplinas?.nome ?? "", h: hora(v.turmas!.modelo_horario_id, s.aula_numero) };
    })
    .sort((a, b) => a.turma_id - b.turma_id || a.aula_numero - b.aula_numero);
  const blocos: { turma_id: number; disciplina_id: number; turma: string; disciplina: string; numeros: number[]; inicio: string }[] = [];
  for (const s of doDia) {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.turma_id === s.turma_id && ultimo.disciplina_id === s.disciplina_id && ultimo.numeros.at(-1) === s.aula_numero - 1) {
      ultimo.numeros.push(s.aula_numero);
    } else {
      blocos.push({ turma_id: s.turma_id, disciplina_id: s.disciplina_id, turma: s.turma, disciplina: s.disciplina, numeros: [s.aula_numero], inicio: s.h?.inicio ?? "" });
    }
  }
  blocos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.numeros[0] - b.numeros[0]);

  const link = (turma: number, disciplina: number, numeros: number[]) =>
    `/professor/aula?turma=${turma}&disciplina=${disciplina}&data=${data}&aula=${numeros.join(",")}`;
  const avisos = eventosDoDia(eventos, data).filter((e) => !e.turmas?.length || e.turmas.some((t) => turmaIds.includes(t)));
  const semHorario = !horarioCadastrado && dia <= 5;
  const mostrarTodas = todas === "1" || sabadoLetivo || semHorario;
  const vinculosLivres = vinculos.filter((v) => !suspensas.has(v.turma_id));

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

      {avisos.length > 0 && (
        <ul className="space-y-1.5">
          {avisos.map((e) => (
            <li
              key={e.id}
              className={`rounded-md px-3 py-2 text-sm ${e.letivo ? "border border-dourado/40 bg-dourado/10 text-texto" : "border border-vinho/30 bg-vinho/5 text-vinho"}`}
            >
              <strong>{TIPOS_EVENTO[e.tipo]?.rotulo ?? e.tipo}:</strong> {e.titulo}
              {!e.letivo && " — sem aula"}
              {e.turmas?.length ? " (algumas turmas)" : ""}
            </li>
          ))}
        </ul>
      )}

      {foraDoPeriodo && (
        <p className="rounded-md border border-borda bg-white px-3 py-2 text-sm text-texto-suave">
          Fora do período letivo de {letivo.ano}.
        </p>
      )}

      {vinculos.length === 0 && (
        <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">
          Nenhuma turma de {letivo.ano} atribuída a você ainda. Fale com a secretaria.
        </p>
      )}

      {blocos.length > 0 && (
        <ul className="space-y-2">
          {blocos.map((a) => {
            const feita = a.numeros.every((n) => lancada(a.turma_id, a.disciplina_id, n));
            return (
              <li key={`${a.turma_id}-${a.numeros[0]}`}>
                <Link
                  href={link(a.turma_id, a.disciplina_id, a.numeros)}
                  className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 active:bg-creme"
                >
                  <span className="w-16 shrink-0 text-center">
                    <span className="block text-xs font-bold text-texto-suave">
                      {a.numeros.map((n) => `${n}ª`).join(" e ")}
                    </span>
                    <span className="block text-sm text-texto">{a.inicio.slice(0, 5)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-lg leading-tight text-verde-escuro">
                      {a.disciplina}
                      {a.numeros.length > 1 && <span className="ml-2 align-middle font-sans text-[11px] font-bold text-dourado">AULA DUPLA</span>}
                    </span>
                    <span className="block truncate text-sm text-texto-suave">{a.turma}</span>
                  </span>
                  <span className={`text-xs font-bold ${feita ? "text-verde-claro" : "text-dourado"}`}>{feita ? "LANÇADA ✓" : "LANÇAR ›"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {vinculos.length > 0 && blocos.length === 0 && !mostrarTodas && (
        <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">
          {suspensas.size === turmaIds.length && turmaIds.length > 0
            ? "Sem aula neste dia pelo calendário."
            : dia >= 6
              ? "Fim de semana."
              : "Nenhuma aula sua neste dia pelo horário."}{" "}
          <Link href={`/professor?data=${data}&todas=1`} className="text-verde-claro underline">
            Lançar mesmo assim
          </Link>
        </p>
      )}

      {vinculos.length > 0 && mostrarTodas && vinculosLivres.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-texto-suave">
            {sabadoLetivo
              ? "Sábado letivo. Escolha a turma e a disciplina:"
              : semHorario
                ? "O horário semanal ainda não foi cadastrado. Escolha a turma e a disciplina:"
                : "Escolha a turma e a disciplina:"}
          </p>
          <ul className="space-y-2">
            {vinculosLivres.map((v) => (
              <li key={`${v.turma_id}-${v.disciplina_id}`}>
                <Link href={link(v.turma_id, v.disciplina_id, [1])} className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 active:bg-creme">
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-lg leading-tight text-verde-escuro">{v.disciplinas?.nome}</span>
                    <span className="block truncate text-sm text-texto-suave">{v.turmas?.nome}</span>
                  </span>
                  <span className={`text-xs font-bold ${lancada(v.turma_id, v.disciplina_id, 1) ? "text-verde-claro" : "text-dourado"}`}>
                    {lancada(v.turma_id, v.disciplina_id, 1) ? "LANÇADA ✓" : "LANÇAR ›"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
