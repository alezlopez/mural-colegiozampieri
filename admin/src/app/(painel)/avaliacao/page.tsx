import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirAdmin } from "@/lib/auth";
import type { RegraAvaliacao } from "@/lib/avaliacao";
import { bimestresDoAno, regraDoSegmento } from "@/lib/avaliacao-db";
import { formatarDataCurta } from "@/lib/datas";
import { SEGMENTOS } from "@/lib/segmentos";
import { publicarBoletim, salvarRegra } from "./actions";

const LINHAS_EXTRAS = 2;

export default async function PaginaAvaliacao({ searchParams }: PageProps<"/avaliacao">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const ano = Number(p.ano) || (await anoEmUso(supabase)).ano;

  const regras = await Promise.all(Object.keys(SEGMENTOS).map(async (s) => [s, await regraDoSegmento(supabase, ano, s)] as const));
  const { data: salvas } = await supabase.from("avaliacao_config").select("segmento").eq("ano", ano);
  const temCadastro = new Set((salvas ?? []).map((r) => r.segmento as string));
  const { bimestres } = await bimestresDoAno(supabase, ano);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">Avaliação e boletim {ano}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Como as notas viram médias em cada segmento, e quando o boletim de cada bimestre fica visível para as famílias.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Ano">
          <Link href={`/avaliacao?ano=${ano - 1}`} className="botao-secundario !px-3">
            ‹ {ano - 1}
          </Link>
          <Link href={`/avaliacao?ano=${ano + 1}`} className="botao-secundario !px-3">
            {ano + 1} ›
          </Link>
        </nav>
      </div>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <section className="mt-4 rounded-xl border border-borda bg-white p-4">
        <h2 className="font-titulo text-xl text-verde-escuro">Publicação do boletim</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Enquanto o bimestre não é publicado, só a escola e os professores veem as notas. Publique depois de conferir o
          fechamento.
        </p>
        {bimestres.length === 0 ? (
          <p className="mt-3 text-sm text-texto-suave">
            Cadastre os bimestres de {ano} em{" "}
            <Link href={`/calendario?ano=${ano}`} className="underline">
              Calendário
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {bimestres.map((b) => (
              <li key={b.numero} className="rounded-lg border border-borda p-3">
                <p className="font-bold text-verde-escuro">{b.numero}º bimestre</p>
                <p className="text-xs capitalize text-texto-suave">
                  {formatarDataCurta(b.inicio)} a {formatarDataCurta(b.fim)}
                </p>
                <p className={`mt-1 text-xs font-bold ${b.boletim_publicado ? "text-verde-claro" : "text-texto-suave"}`}>
                  {b.boletim_publicado ? "PUBLICADO PARA AS FAMÍLIAS" : "NÃO PUBLICADO"}
                </p>
                <form action={publicarBoletim} className="mt-2">
                  <input type="hidden" name="ano" value={ano} />
                  <input type="hidden" name="numero" value={b.numero} />
                  <input type="hidden" name="publicar" value={String(!b.boletim_publicado)} />
                  <button className={b.boletim_publicado ? "botao-secundario !px-3 !py-1.5" : "botao-primario !px-3 !py-1.5"}>
                    {b.boletim_publicado ? "Recolher" : "Publicar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {regras.map(([segmento, regra]) => (
          <FormRegra key={segmento} ano={ano} segmento={segmento} regra={regra} cadastrada={temCadastro.has(segmento)} />
        ))}
      </div>

      <p className="mt-4 text-xs text-texto-suave">
        Arredondamento da escola, sobre a parte decimal: até 0,25 → 0; acima de 0,25 até 0,59 → 0,5; de 0,60 em diante → 1
        (ex.: 6,25 → 6,0; 6,3 → 6,5; 6,6 → 7,0). Ele vale para a média do bimestre (antes de decidir a recuperação) e para a
        média final. As notas de cada avaliação ficam como o professor lançou.
      </p>
    </div>
  );
}

function FormRegra({ ano, segmento, regra, cadastrada }: { ano: number; segmento: string; regra: RegraAvaliacao; cadastrada: boolean }) {
  return (
    <section className="rounded-xl border border-borda bg-white p-4">
      <h2 className="font-titulo text-xl text-verde-escuro">{SEGMENTOS[segmento]}</h2>
      {!cadastrada && <p className="text-xs font-bold text-dourado">PADRÃO — REVISE E SALVE</p>}
      <form action={salvarRegra} className="mt-3 space-y-3">
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="segmento" value={segmento} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="descritivo" defaultChecked={regra.descritivo} />
          Avaliação descritiva (parecer em texto, sem nota)
        </label>
        <div>
          <p className="rotulo">Avaliações do bimestre (nome e peso)</p>
          <div className="space-y-1.5">
            {[...regra.avaliacoes, ...Array.from({ length: LINHAS_EXTRAS }, () => null)].map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="hidden" name="chave" value={a?.chave ?? ""} />
                <input name="nome" defaultValue={a?.nome ?? ""} placeholder={a ? "" : "Nova avaliação"} maxLength={60} className="campo !py-1.5" aria-label="Nome da avaliação" />
                <input name="peso" type="number" min={0.1} max={10} step={0.1} defaultValue={a?.peso ?? 1} className="campo !w-20 !py-1.5" aria-label="Peso" />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-texto-suave">Para tirar uma avaliação, apague o nome. Notas já lançadas nela deixam de contar.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="rotulo">Média para aprovar</span>
            <input name="media_aprovacao" defaultValue={String(regra.media_aprovacao).replace(".", ",")} className="campo" />
          </label>
          <label className="block">
            <span className="rotulo">Arredondamento</span>
            <select name="arredondamento" defaultValue={regra.arredondamento} className="campo">
              <option value="escola">Regra da escola (0 · 0,5 · 1)</option>
              <option value="nenhum">Sem arredondar</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="recuperacao_bimestral" defaultChecked={regra.recuperacao_bimestral} />
          Recuperação bimestral (substitui a média se for maior)
        </label>
        <button className="botao-primario">Salvar</button>
      </form>
    </section>
  );
}
