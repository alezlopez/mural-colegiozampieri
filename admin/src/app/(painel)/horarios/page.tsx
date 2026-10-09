import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { conflitosDeProfessor, DIAS_SEMANA, hhmm, minutos, type AulaModelo, type SlotHorario } from "@/lib/horarios";
import { Avisos } from "@/components/Avisos";
import { salvarHorario, trocarModeloDaTurma } from "./actions";

type Turma = { id: number; nome: string; ano: number; segmento: string; modelo_horario_id: number | null };
type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  professor_id: number | null;
  disciplinas: { nome: string } | null;
  professores: { nome: string } | null;
};

const SEGMENTOS: Record<string, string> = {
  infantil: "Educação Infantil",
  fundamental1: "Fundamental I",
  fundamental2: "Fundamental II",
  medio: "Ensino Médio",
};

const primeiroNome = (nome: string | undefined) => nome?.split(" ")[0] ?? "";

export default async function PaginaHorarios({ searchParams }: PageProps<"/horarios">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const turmaId = Number(p.turma);
  const salvo = typeof p.salvo === "string" ? p.salvo : null;
  const erro = typeof p.erro === "string" ? p.erro : null;

  const { data: todasTurmas } = await supabase
    .from("turmas")
    .select("id,nome,ano,segmento,modelo_horario_id")
    .eq("ativa", true)
    .order("nome")
    .overrideTypes<Turma[], { merge: false }>();
  const anos = [...new Set((todasTurmas ?? []).map((t) => t.ano))].sort();
  const ano = Number(p.ano) || anos.at(-1);
  const turmas = (todasTurmas ?? []).filter((t) => t.ano === ano);
  const ids = turmas.map((t) => t.id);

  const [{ data: modelos }, { data: aulasModelo }, { data: vinculosBrutos }, { data: slotsBrutos }, { data: disciplinas }] =
    await Promise.all([
      supabase.from("modelos_horario").select("id,nome").order("id"),
      supabase.from("modelo_horario_aulas").select("modelo_id,numero,inicio,fim").order("numero"),
      supabase
        .from("turma_disciplinas")
        .select("turma_id,disciplina_id,professor_id,disciplinas(nome),professores(nome)")
        .in("turma_id", ids)
        .overrideTypes<Vinculo[], { merge: false }>(),
      supabase.from("turma_horario").select("turma_id,dia_semana,aula_numero,disciplina_id").in("turma_id", ids),
      supabase.from("disciplinas").select("id,nome").eq("ativa", true).order("nome"),
    ]);
  const aulas = (aulasModelo ?? []) as AulaModelo[];
  const vinculos = vinculosBrutos ?? [];
  const slots = (slotsBrutos ?? []) as SlotHorario[];
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));
  const vinculo = new Map(vinculos.map((v) => [`${v.turma_id}:${v.disciplina_id}`, v]));
  const nomeProfessor = new Map(vinculos.filter((v) => v.professor_id).map((v) => [v.professor_id!, v.professores?.nome ?? ""]));
  const nomeDisciplina = new Map((disciplinas ?? []).map((d) => [d.id as number, d.nome as string]));

  const conflitos = conflitosDeProfessor(
    slots,
    (t, d) => vinculo.get(`${t}:${d}`)?.professor_id,
    (t) => turmaPorId.get(t)?.modelo_horario_id,
    aulas,
  );
  const turmasComConflito = new Set(conflitos.flatMap((c) => [c.a.turma_id, c.b.turma_id]));
  const aulasDoModelo = (modelo: number | null) => aulas.filter((a) => a.modelo_id === modelo);

  const turma = turmaPorId.get(turmaId);

  // ------------------------------------------------------------------ lista de turmas
  if (!turma) {
    const porSegmento = Object.entries(SEGMENTOS)
      .map(([chave, rotulo]) => ({ rotulo, turmas: turmas.filter((t) => t.segmento === chave) }))
      .filter((s) => s.turmas.length > 0);
    return (
      <div>
        <Cabecalho ano={ano} anos={anos} />
        <Avisos salvo={salvo} erro={erro} />
        {turmas.length === 0 && (
          <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
            Nenhuma turma ainda. Elas aparecem depois da sincronização com a Mhund.
          </p>
        )}
        {conflitos.length > 0 && (
          <p className="mb-4 rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
            {conflitos.length} choque(s) de horário: professor com aula em duas turmas ao mesmo tempo. As turmas
            afetadas estão marcadas abaixo.
          </p>
        )}
        <div className="space-y-6">
          {porSegmento.map((s) => (
            <section key={s.rotulo}>
              <h2 className="rotulo">{s.rotulo}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {s.turmas.map((t) => {
                  const total = aulasDoModelo(t.modelo_horario_id).length * DIAS_SEMANA.length;
                  const feitas = slots.filter((x) => x.turma_id === t.id && x.dia_semana <= 5).length;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/horarios?turma=${t.id}`}
                        className="flex items-center gap-3 rounded-xl border border-borda bg-white p-3 hover:border-verde-claro"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-verde-escuro">{t.nome}</span>
                        {turmasComConflito.has(t.id) && <span className="text-xs font-bold text-vinho">CHOQUE</span>}
                        <span className={`text-xs font-bold ${total > 0 && feitas >= total ? "text-verde-claro" : "text-dourado"}`}>
                          {feitas}/{total}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ grade de uma turma
  const daTurma = aulasDoModelo(turma.modelo_horario_id);
  const vinculosDaTurma = vinculos
    .filter((v) => v.turma_id === turma.id)
    .sort((a, b) => (a.disciplinas?.nome ?? "").localeCompare(b.disciplinas?.nome ?? ""));
  const slotsDaTurma = slots.filter((s) => s.turma_id === turma.id);
  const valor = (dia: number, aula: number) => slotsDaTurma.find((s) => s.dia_semana === dia && s.aula_numero === aula)?.disciplina_id;

  // Opções: disciplinas da grade da turma (com o professor). Sem grade, todas as disciplinas.
  const opcoes =
    vinculosDaTurma.length > 0
      ? vinculosDaTurma.map((v) => ({
          id: v.disciplina_id,
          rotulo: `${v.disciplinas?.nome ?? "?"}${v.professor_id ? ` · ${primeiroNome(nomeProfessor.get(v.professor_id))}` : ""}`,
        }))
      : [...nomeDisciplina].map(([id, nome]) => ({ id, rotulo: nome }));
  for (const s of slotsDaTurma) {
    if (!opcoes.some((o) => o.id === s.disciplina_id)) {
      opcoes.push({ id: s.disciplina_id, rotulo: `${nomeDisciplina.get(s.disciplina_id) ?? "?"} (fora da grade)` });
    }
  }

  const conflitosDaTurma = conflitos.filter((c) => c.a.turma_id === turma.id || c.b.turma_id === turma.id);
  const contagem = new Map<number, number>();
  for (const s of slotsDaTurma) contagem.set(s.disciplina_id, (contagem.get(s.disciplina_id) ?? 0) + 1);

  return (
    <div>
      <Link href="/horarios" className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Todas as turmas
      </Link>
      <h1 className="mt-2 font-titulo text-2xl text-verde-escuro sm:text-3xl">{turma.nome}</h1>
      <Avisos salvo={salvo} erro={erro} />

      <form action={trocarModeloDaTurma} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="turma_id" value={turma.id} />
        <label className="min-w-48 flex-1 sm:flex-none">
          <span className="rotulo">Modelo de horário</span>
          <select name="modelo_id" defaultValue={turma.modelo_horario_id ?? ""} className="campo" required>
            <option value="" disabled>
              Escolha…
            </option>
            {(modelos ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="botao-secundario">Trocar</button>
        <Link href="/horarios/modelos" className="ml-auto text-sm text-verde-claro underline-offset-4 hover:underline">
          Editar horários dos modelos ›
        </Link>
      </form>

      {conflitosDaTurma.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
          {conflitosDaTurma.map((c, i) => {
            const outra = c.a.turma_id === turma.id ? c.b : c.a;
            const minha = c.a.turma_id === turma.id ? c.a : c.b;
            return (
              <li key={i}>
                Choque: {nomeProfessor.get(c.professor)} tem {DIAS_SEMANA[minha.dia_semana - 1]?.nome.toLowerCase()},{" "}
                {minha.aula_numero}ª aula aqui e também em{" "}
                <Link href={`/horarios?turma=${outra.turma_id}`} className="underline">
                  {turmaPorId.get(outra.turma_id)?.nome}
                </Link>{" "}
                ({outra.aula_numero}ª aula).
              </li>
            );
          })}
        </ul>
      )}

      {daTurma.length === 0 ? (
        <p className="mt-6 rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">
          Escolha um modelo de horário para a turma.
        </p>
      ) : (
        <form action={salvarHorario} className="mt-6">
          <input type="hidden" name="turma_id" value={turma.id} />
          <div className="overflow-x-auto rounded-xl border border-borda bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-creme text-left">
                  <th className="w-24 px-2 py-2 text-xs font-bold text-texto-suave">Aula</th>
                  {DIAS_SEMANA.map((d) => (
                    <th key={d.numero} className="px-2 py-2 text-xs font-bold tracking-wider text-texto-suave uppercase">
                      {d.curto}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daTurma.map((a, i) => {
                  const anterior = daTurma[i - 1];
                  const intervalo = anterior && minutos(a.inicio) - minutos(anterior.fim) >= 10;
                  return [
                    intervalo && (
                      <tr key={`int-${a.numero}`} className="bg-creme/60">
                        <td colSpan={6} className="px-2 py-1 text-center text-[11px] font-bold tracking-[0.18em] text-texto-suave">
                          INTERVALO {hhmm(anterior.fim)}–{hhmm(a.inicio)}
                        </td>
                      </tr>
                    ),
                    <tr key={a.numero} className="border-t border-borda">
                      <td className="px-2 py-1.5 align-middle">
                        <span className="block font-bold text-verde-escuro">{a.numero}ª</span>
                        <span className="block text-[11px] text-texto-suave">
                          {hhmm(a.inicio)}–{hhmm(a.fim)}
                        </span>
                      </td>
                      {DIAS_SEMANA.map((d) => (
                        <td key={d.numero} className="px-1 py-1">
                          <select
                            name={`h_${d.numero}_${a.numero}`}
                            defaultValue={valor(d.numero, a.numero) ?? ""}
                            aria-label={`${d.nome}, ${a.numero}ª aula`}
                            className="w-full rounded border border-borda bg-white px-1.5 py-1.5 text-xs text-texto focus:border-verde-claro focus:outline-none"
                          >
                            <option value="">—</option>
                            {opcoes.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.rotulo}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="botao-primario">Salvar horário</button>
            <span className="text-xs text-texto-suave">Choques com outras turmas aparecem depois de salvar.</span>
          </div>
        </form>
      )}

      {contagem.size > 0 && (
        <section className="mt-8">
          <h2 className="rotulo">Aulas por semana</h2>
          <ul className="flex flex-wrap gap-2">
            {[...contagem]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <li key={id} className="rounded-full border border-borda bg-white px-3 py-1 text-xs text-texto">
                  {nomeDisciplina.get(id) ?? "?"} <strong className="text-verde-escuro">{n}</strong>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Cabecalho({ ano, anos }: { ano: number | undefined; anos: number[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <h1 className="font-titulo text-3xl text-verde-escuro">Horários{ano ? ` ${ano}` : ""}</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Monte o horário semanal de cada turma. Ele organiza o dia do professor no diário e, depois, o &quot;Hoje na
          escola&quot; das famílias.
        </p>
      </div>
      <div className="flex gap-2 text-sm">
        {anos.length > 1 &&
          anos.map((a) => (
            <Link key={a} href={`/horarios?ano=${a}`} className={a === ano ? "font-bold text-verde-escuro" : "text-verde-claro"}>
              {a}
            </Link>
          ))}
        <Link href="/horarios/modelos" className="botao-secundario">
          Modelos de horário
        </Link>
      </div>
    </div>
  );
}
