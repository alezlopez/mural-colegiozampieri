import Link from "next/link";
import { notFound } from "next/navigation";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { rotuloPeriodo, type Periodo } from "@/lib/planejamento";
import { darVisto } from "../actions";

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
  atualizado_em: string;
  turmas: { nome: string } | null;
  disciplinas: { nome: string } | null;
  professores: { nome: string } | null;
};

const SECOES = [
  ["objetivos", "Objetivos"],
  ["texto", "Conteúdos"],
  ["metodologia", "Metodologia"],
  ["recursos", "Recursos"],
  ["avaliacao", "Avaliação"],
] as const;

export default async function VerPlanejamento({ params, searchParams }: PageProps<"/planejamentos/[id]">) {
  const { supabase } = await exigirAdmin();
  const { id } = await params;
  const p = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await supabase
    .from("planejamentos")
    .select("id,periodo,inicio,fim,objetivos,texto,metodologia,recursos,avaliacao,comentario_coordenacao,visto_em,atualizado_em,turmas(nome),disciplinas(nome),professores(nome)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Planejamento | null, { merge: false }>();
  if (!data) notFound();
  const pl = data;

  return (
    <div className="max-w-3xl">
      <Link href={`/planejamentos?semana=${pl.inicio}`} className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Planejamentos
      </Link>
      <p className="mt-2 text-[11px] font-bold tracking-[0.2em] text-dourado">{rotuloPeriodo(pl.periodo, pl.inicio, pl.fim).toUpperCase()}</p>
      <h1 className="font-titulo text-2xl text-verde-escuro">
        {pl.disciplinas?.nome} · {pl.turmas?.nome}
      </h1>
      <p className="text-sm text-texto-suave">
        {pl.professores?.nome} · atualizado em {formatarDataHora(pl.atualizado_em)}
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <div className="mt-5 space-y-4 rounded-xl border border-borda bg-white p-4">
        {SECOES.map(([campo, rotulo]) =>
          pl[campo] ? (
            <section key={campo}>
              <h2 className="rotulo">{rotulo}</h2>
              <p className="whitespace-pre-line text-sm text-texto">{pl[campo]}</p>
            </section>
          ) : null,
        )}
      </div>

      <form action={darVisto} className="mt-5 space-y-3 rounded-xl border border-borda bg-white p-4">
        <input type="hidden" name="id" value={pl.id} />
        <p className={`text-sm font-bold ${pl.visto_em ? "text-verde-claro" : "text-dourado"}`}>
          {pl.visto_em ? `Visto em ${formatarDataHora(pl.visto_em)}` : "Aguardando visto"}
        </p>
        <label className="block">
          <span className="rotulo">Comentário para o professor (opcional)</span>
          <textarea name="comentario" rows={3} maxLength={4000} defaultValue={pl.comentario_coordenacao ?? ""} className="campo" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button name="acao" value="visto" className="botao-primario">
            {pl.visto_em ? "Atualizar comentário" : "Dar visto"}
          </button>
          {pl.visto_em && (
            <button name="acao" value="retirar" className="botao-secundario">
              Retirar visto
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
