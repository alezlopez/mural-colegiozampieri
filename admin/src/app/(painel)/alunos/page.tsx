import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirArea } from "@/lib/auth";

type Achado = { codigo: string; nome: string; turma: string | null; ativo: boolean };

export default async function BuscarAluno({ searchParams }: PageProps<"/alunos">) {
  const { supabase } = await exigirArea("acompanhamento");
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim() : "";
  const { ano } = await anoEmUso(supabase);

  let achados: Achado[] = [];
  if (q.length >= 2) {
    const termo = q.replace(/[%_,()"\\]/g, " ").trim();
    const { data } = await supabase
      .from("alunos")
      .select("codigo,nome,ativo,matriculas(ano,ativa,turmas(nome))")
      .or(`nome.ilike.%${termo.replace(/\s+/g, "%")}%,codigo.eq.${termo}`)
      .order("ativo", { ascending: false })
      .order("nome")
      .limit(60)
      .overrideTypes<{ codigo: string; nome: string; ativo: boolean; matriculas: { ano: number; ativa: boolean; turmas: { nome: string } | null }[] }[], { merge: false }>();
    achados = (data ?? []).map((a) => ({
      codigo: a.codigo,
      nome: a.nome,
      ativo: a.ativo,
      turma: a.matriculas.find((m) => m.ano === ano && m.ativa)?.turmas?.nome ?? null,
    }));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-titulo text-3xl text-verde-escuro">Ficha do aluno</h1>
      <p className="mt-1 text-sm text-texto-suave">Busque pelo nome ou pelo código para ver notas, frequência, turma e responsáveis.</p>
      <form className="mt-4 flex gap-2" action="/alunos">
        <input name="q" defaultValue={q} placeholder="Nome ou código do aluno" className="campo flex-1" autoFocus minLength={2} />
        <button className="botao-primario">Buscar</button>
      </form>

      {q.length >= 2 && (
        <ul className="mt-4 divide-y divide-borda rounded-xl border border-borda bg-white">
          {achados.length === 0 && <li className="p-4 text-sm text-texto-suave">Ninguém encontrado.</li>}
          {achados.map((a) => (
            <li key={a.codigo}>
              <Link href={`/alunos/${a.codigo}`} className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-creme ${a.ativo ? "" : "opacity-55"}`}>
                <span className="min-w-0 flex-1 truncate font-bold text-verde-escuro">{a.nome}</span>
                <span className="text-xs text-texto-suave">{a.turma ?? (a.ativo ? `sem turma em ${ano}` : "inativo")}</span>
                <span className="text-[11px] text-texto-suave">{a.codigo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
