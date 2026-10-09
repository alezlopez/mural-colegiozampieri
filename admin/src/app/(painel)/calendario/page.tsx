import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { contarDiasLetivos, MINIMO_DIAS_LETIVOS, pontosFacultativos, TIPOS_EVENTO, type EventoCalendario } from "@/lib/calendario";
import { formatarDataCurta, hojeEmBrasilia } from "@/lib/datas";
import { excluirEvento, importarFeriados, salvarAnoLetivo } from "./actions";
import { FormEvento } from "./FormEvento";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const COR_TIPO: Record<string, string> = {
  feriado: "bg-vinho/10 text-vinho",
  recesso: "bg-vinho/10 text-vinho",
  sabado_letivo: "bg-verde-claro/15 text-verde-claro",
  avaliacao: "bg-dourado/15 text-dourado",
  conselho: "bg-dourado/15 text-dourado",
};

export default async function PaginaCalendario({ searchParams }: PageProps<"/calendario">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;

  const { data: anoAtivo } = await supabase.from("anos_letivos").select("ano").eq("ativo", true).maybeSingle();
  const ano = Number(p.ano) || anoAtivo?.ano || Number(hojeEmBrasilia().slice(0, 4));
  const editarId = Number(p.editar);

  const [{ data: anoLetivo }, { data: bimestres }, { data: eventosBrutos }, { data: turmas }] = await Promise.all([
    supabase.from("anos_letivos").select("ano,inicio,fim,ativo").eq("ano", ano).maybeSingle(),
    supabase.from("bimestres").select("numero,inicio,fim").eq("ano", ano).order("numero"),
    supabase.from("calendario_eventos").select("id,inicio,fim,tipo,titulo,descricao,letivo,turmas,publico").eq("ano", ano).order("inicio"),
    supabase.from("turmas").select("id,nome").eq("ano", ano).eq("ativa", true).order("nome"),
  ]);
  const eventos = (eventosBrutos ?? []) as EventoCalendario[];
  const nomeTurma = new Map((turmas ?? []).map((t) => [t.id as number, t.nome as string]));
  const editando = eventos.find((e) => e.id === editarId) ?? null;
  const bim = (n: number) => bimestres?.find((b) => b.numero === n);

  const diasNoAno = anoLetivo ? contarDiasLetivos(anoLetivo.inicio, anoLetivo.fim, eventos) : null;
  const diasPorBimestre = (bimestres ?? []).map((b) => ({ numero: b.numero, dias: contarDiasLetivos(b.inicio, b.fim, eventos) }));

  const porMes = new Map<number, EventoCalendario[]>();
  for (const e of eventos) {
    const mes = Number(e.inicio.slice(5, 7)) - 1;
    porMes.set(mes, [...(porMes.get(mes) ?? []), e]);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">Calendário {ano}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Ano letivo, bimestres, feriados, recessos e eventos. Os dias sem aula saem da contagem de dias letivos e do
            diário; os eventos públicos aparecem para as famílias.
          </p>
        </div>
        <nav className="flex items-center gap-3 text-sm" aria-label="Ano">
          <Link href={`/calendario?ano=${ano - 1}`} className="botao-secundario !px-3">
            ‹ {ano - 1}
          </Link>
          <Link href={`/calendario?ano=${ano + 1}`} className="botao-secundario !px-3">
            {ano + 1} ›
          </Link>
        </nav>
      </div>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* ---------------------------------------------------------------- ano letivo */}
        <section className="space-y-4">
          <div className="rounded-xl border border-borda bg-white p-4">
            <h2 className="font-titulo text-xl text-verde-escuro">Ano letivo e bimestres</h2>
            <form action={salvarAnoLetivo} className="mt-3 space-y-3">
              <input type="hidden" name="ano" value={ano} />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="rotulo">Início das aulas</span>
                  <input type="date" name="inicio" defaultValue={anoLetivo?.inicio} required className="campo" />
                </label>
                <label className="block">
                  <span className="rotulo">Fim das aulas</span>
                  <input type="date" name="fim" defaultValue={anoLetivo?.fim} required className="campo" />
                </label>
              </div>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
                  <span className="text-sm font-bold text-verde-escuro">{n}º bim.</span>
                  <input type="date" name={`b${n}_inicio`} defaultValue={bim(n)?.inicio} required className="campo !py-1.5" aria-label={`Início do ${n}º bimestre`} />
                  <input type="date" name={`b${n}_fim`} defaultValue={bim(n)?.fim} required className="campo !py-1.5" aria-label={`Fim do ${n}º bimestre`} />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" defaultChecked={anoLetivo?.ativo ?? false} />
                Ano em uso (o diário e o app trabalham com ele)
              </label>
              <button className="botao-primario">Salvar ano letivo</button>
            </form>
          </div>

          {diasNoAno !== null && (
            <div className="rounded-xl border border-borda bg-white p-4">
              <h2 className="rotulo">Dias letivos (escola toda)</h2>
              <p className={`font-titulo text-3xl ${diasNoAno >= MINIMO_DIAS_LETIVOS ? "text-verde-claro" : "text-vinho"}`}>
                {diasNoAno} <span className="font-sans text-sm text-texto-suave">de {MINIMO_DIAS_LETIVOS} exigidos pela LDB</span>
              </p>
              {diasNoAno < MINIMO_DIAS_LETIVOS && (
                <p className="mt-1 text-xs text-vinho">
                  Faltam {MINIMO_DIAS_LETIVOS - diasNoAno}. Inclua sábados letivos ou ajuste as datas.
                </p>
              )}
              {diasPorBimestre.length > 0 && (
                <ul className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {diasPorBimestre.map((b) => (
                    <li key={b.numero} className="rounded-md bg-creme px-1 py-2">
                      <span className="block text-[11px] font-bold text-texto-suave">{b.numero}º BIM.</span>
                      <span className="block font-titulo text-lg text-verde-escuro">{b.dias}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-texto-suave">
                Conta segunda a sexta, menos feriados e recessos da escola toda, mais os sábados letivos. Eventos só de
                algumas turmas não entram nesta conta.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-borda bg-white p-4">
            <h2 className="font-titulo text-xl text-verde-escuro">Feriados nacionais</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Inclui os feriados nacionais de {ano} e a Sexta-feira Santa. Não duplica os que já estiverem aqui.
              Feriados municipais e estaduais você inclui como evento.
            </p>
            <form action={importarFeriados} className="mt-3 space-y-2 text-sm">
              <input type="hidden" name="ano" value={ano} />
              {pontosFacultativos(ano).map((pf) => (
                <label key={pf.titulo} className="flex items-center gap-2">
                  <input type="checkbox" name={pf.titulo === "Carnaval" ? "carnaval" : "corpus"} />
                  Incluir {pf.titulo} como recesso ({formatarDataCurta(pf.inicio)}
                  {pf.fim !== pf.inicio ? ` e ${formatarDataCurta(pf.fim)}` : ""})
                </label>
              ))}
              <button className="botao-secundario">Importar feriados</button>
            </form>
          </div>
        </section>

        {/* ---------------------------------------------------------------- eventos */}
        <section className="space-y-4">
          <div id="evento" className="rounded-xl border border-borda bg-white p-4">
            <h2 className="mb-3 font-titulo text-xl text-verde-escuro">{editando ? "Editar evento" : "Novo evento"}</h2>
            <FormEvento key={editando?.id ?? "novo"} ano={ano} evento={editando} turmas={(turmas ?? []) as { id: number; nome: string }[]} />
          </div>

          {eventos.length === 0 ? (
            <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
              Nenhum evento em {ano}. Comece importando os feriados nacionais.
            </p>
          ) : (
            [...porMes].map(([mes, lista]) => (
              <div key={mes}>
                <h3 className="rotulo">{MESES[mes]}</h3>
                <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
                  {lista.map((e) => (
                    <li key={e.id} className={`flex items-start gap-3 p-3 ${e.id === editarId ? "bg-creme" : ""}`}>
                      <span className="w-24 shrink-0 text-xs capitalize text-texto">
                        {formatarDataCurta(e.inicio)}
                        {e.fim !== e.inicio && <span className="block text-texto-suave">até {formatarDataCurta(e.fim)}</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-verde-escuro">{e.titulo}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${COR_TIPO[e.tipo] ?? "bg-creme text-texto-suave"}`}>
                            {TIPOS_EVENTO[e.tipo]?.rotulo ?? e.tipo}
                          </span>
                          {!e.letivo && <span className="rounded-full bg-creme px-2 py-0.5 text-texto-suave">sem aula</span>}
                          {!e.publico && <span className="rounded-full bg-creme px-2 py-0.5 text-texto-suave">interno</span>}
                          {e.turmas?.length ? (
                            <span className="rounded-full bg-creme px-2 py-0.5 text-texto-suave" title={e.turmas.map((t) => nomeTurma.get(t)).join("; ")}>
                              {e.turmas.length} turma{e.turmas.length > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </span>
                        {e.descricao && <span className="mt-1 block text-xs text-texto-suave">{e.descricao}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                        <Link href={`/calendario?ano=${ano}&editar=${e.id}#evento`} className="text-verde-claro underline-offset-4 hover:underline">
                          Editar
                        </Link>
                        <form action={excluirEvento}>
                          <input type="hidden" name="ano" value={ano} />
                          <input type="hidden" name="id" value={e.id} />
                          <button className="text-vinho underline-offset-4 hover:underline">Excluir</button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
