import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirAdmin } from "@/lib/auth";
import { hojeEmBrasilia, somarDias } from "@/lib/datas";
import { cobre, rotuloPeriodo, semanaDe, type Periodo } from "@/lib/planejamento";

type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  professor_id: number | null;
  turmas: { nome: string; ano: number; ativa: boolean } | null;
  disciplinas: { nome: string } | null;
  professores: { nome: string } | null;
};
type Plano = { id: string; turma_id: number; disciplina_id: number; periodo: Periodo; inicio: string; fim: string; visto_em: string | null };

export default async function Planejamentos({ searchParams }: PageProps<"/planejamentos">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const dataBase = typeof p.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.semana) ? p.semana : hojeEmBrasilia();
  const { inicio, fim } = semanaDe(dataBase);
  const soPendentes = p.filtro === "pendentes";
  const letivo = await anoEmUso(supabase);

  const [{ data: vinculosBrutos }, { data: planosBrutos }] = await Promise.all([
    supabase
      .from("turma_disciplinas")
      .select("turma_id,disciplina_id,professor_id,turmas(nome,ano,ativa),disciplinas(nome),professores(nome)")
      .not("professor_id", "is", null)
      .overrideTypes<Vinculo[], { merge: false }>(),
    supabase.from("planejamentos").select("id,turma_id,disciplina_id,periodo,inicio,fim,visto_em").lte("inicio", fim).gte("fim", inicio),
  ]);
  const vinculos = (vinculosBrutos ?? []).filter((v) => v.turmas?.ativa && v.turmas.ano === letivo.ano);
  const planos = (planosBrutos ?? []) as Plano[];

  // Por professor: cada turma/disciplina com os planejamentos que cobrem a semana (semanal ou mensal).
  const porProfessor = new Map<string, { nome: string; itens: { v: Vinculo; planos: Plano[] }[] }>();
  for (const v of vinculos) {
    const doVinculo = planos.filter((pl) => pl.turma_id === v.turma_id && pl.disciplina_id === v.disciplina_id && cobre(pl, inicio, fim));
    if (soPendentes && doVinculo.length > 0 && doVinculo.every((pl) => pl.visto_em)) continue;
    const chave = String(v.professor_id);
    const g = porProfessor.get(chave) ?? { nome: v.professores?.nome ?? "?", itens: [] };
    g.itens.push({ v, planos: doVinculo });
    porProfessor.set(chave, g);
  }
  const grupos = [...porProfessor.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const total = vinculos.length;
  const comPlano = vinculos.filter((v) => planos.some((pl) => pl.turma_id === v.turma_id && pl.disciplina_id === v.disciplina_id && cobre(pl, inicio, fim))).length;
  const aguardando = planos.filter((pl) => !pl.visto_em).length;
  const link = (semana: string, filtro = soPendentes) => `/planejamentos?semana=${semana}${filtro ? "&filtro=pendentes" : ""}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">Planejamentos</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Quem planejou a semana (planejamento semanal ou mensal que a cubra) e o visto da coordenação.
          </p>
        </div>
        <nav className="flex items-center gap-2 text-sm" aria-label="Semana">
          <Link href={link(somarDias(inicio, -7))} className="botao-secundario !px-3 !py-1.5">
            ‹
          </Link>
          <span className="font-bold text-verde-escuro">{rotuloPeriodo("semanal", inicio, fim)}</span>
          <Link href={link(somarDias(inicio, 7))} className="botao-secundario !px-3 !py-1.5">
            ›
          </Link>
        </nav>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span>
          <strong>{comPlano}</strong> de {total} turmas/disciplinas com planejamento ·{" "}
          <strong className={aguardando ? "text-dourado" : ""}>{aguardando}</strong> aguardando visto
        </span>
        <Link href={link(dataBase, !soPendentes)} className="ml-auto text-verde-claro underline-offset-4 hover:underline">
          {soPendentes ? "Mostrar todos" : "Só o que falta (sem planejamento ou sem visto)"}
        </Link>
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          {total === 0 ? `Nenhum professor atribuído às turmas de ${letivo.ano} ainda.` : "Tudo planejado e com visto nesta semana."}
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <section key={g.nome} className="rounded-xl border border-borda bg-white">
              <h2 className="border-b border-borda px-4 py-2 font-titulo text-lg text-verde-escuro">{g.nome}</h2>
              <ul className="divide-y divide-borda">
                {g.itens
                  .sort((a, b) => (a.v.turmas?.nome ?? "").localeCompare(b.v.turmas?.nome ?? "", "pt-BR", { numeric: true }))
                  .map(({ v, planos: pls }) => (
                    <li key={`${v.turma_id}-${v.disciplina_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        {v.disciplinas?.nome} · <span className="text-texto-suave">{v.turmas?.nome}</span>
                      </span>
                      {pls.length === 0 ? (
                        <span className="text-xs font-bold text-vinho">SEM PLANEJAMENTO</span>
                      ) : (
                        pls.map((pl) => (
                          <Link
                            key={pl.id}
                            href={`/planejamentos/${pl.id}`}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pl.visto_em ? "bg-verde-claro/15 text-verde-claro" : "bg-dourado/15 text-dourado"}`}
                          >
                            {pl.periodo === "mensal" ? "Mensal" : "Semanal"} · {pl.visto_em ? "visto ✓" : "ler e dar visto"}
                          </Link>
                        ))
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
