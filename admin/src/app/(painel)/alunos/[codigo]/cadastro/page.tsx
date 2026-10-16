import { notFound } from "next/navigation";
import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirArea } from "@/lib/auth";
import { formatarCpf } from "@/lib/cpf";
import { exibirTelefone } from "@/lib/telefone";
import { adicionarResponsavel, desvincularResponsavel, matricularAluno, salvarDadosAluno, salvarResponsavel } from "./actions";
import { CamposEndereco } from "./CamposEndereco";
import { CamposResponsavel, PARENTESCOS, type Responsavel, type Vinculo } from "./CamposResponsavel";

type Dados = {
  nome_social: string | null;
  sexo: "M" | "F" | null;
  nascimento: string | null;
  naturalidade: string | null;
  nacionalidade: string;
  cpf: string | null;
  rg: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export default async function CadastroDoAluno({ params, searchParams }: PageProps<"/alunos/[codigo]/cadastro">) {
  const { supabase, podeEditar, permissoes } = await exigirArea("secretaria");
  const { codigo } = await params;
  const p = await searchParams;
  const { ano } = await anoEmUso(supabase);

  const [{ data: aluno }, { data: dados }, { data: vinculos }, { data: acessos }, { data: matriculas }, { data: turmas }] = await Promise.all([
    supabase.from("alunos").select("codigo,nome,ativo").eq("codigo", codigo).maybeSingle(),
    supabase.from("aluno_dados").select("*").eq("aluno_codigo", codigo).maybeSingle<Dados>(),
    supabase
      .from("aluno_vinculos")
      .select("parentesco,parentesco_descricao,financeiro,acesso_app,responsaveis(*)")
      .eq("aluno_codigo", codigo)
      .overrideTypes<(Vinculo & { responsaveis: Responsavel })[], { merge: false }>(),
    supabase.from("aluno_responsaveis").select("telefone,nome,origem").eq("aluno_codigo", codigo),
    supabase
      .from("matriculas")
      .select("turma_id,ano,ativa,turmas(nome)")
      .eq("aluno_codigo", codigo)
      .order("ano", { ascending: false })
      .overrideTypes<{ turma_id: number; ano: number; ativa: boolean; turmas: { nome: string } | null }[], { merge: false }>(),
    supabase.from("turmas").select("id,nome,ano").eq("ativa", true).gte("ano", ano).order("ano").order("nome"),
  ]);
  if (!aluno) notFound();

  const lista = (vinculos ?? []).sort((a, b) => Number(b.financeiro) - Number(a.financeiro) || a.responsaveis.nome.localeCompare(b.responsaveis.nome, "pt-BR"));
  const financeiro = lista.find((v) => v.financeiro)?.responsaveis;
  const daMhund = (acessos ?? []).filter((a) => a.origem === "mhund");
  const atual = (matriculas ?? []).find((m) => m.ativa && m.ano === ano);
  const anos = [...new Set((turmas ?? []).map((t) => t.ano as number))];
  const salvo = typeof p.salvo === "string" ? p.salvo : null;
  const erro = typeof p.erro === "string" ? p.erro : null;

  return (
    <div className="max-w-4xl">
      <Link href={permissoes.acompanhamento !== "nenhum" ? `/alunos/${codigo}` : "/alunos"} className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ {permissoes.acompanhamento !== "nenhum" ? "Ficha do aluno" : "Buscar aluno"}
      </Link>
      <h1 className="mt-2 font-titulo text-3xl text-verde-escuro">Cadastro · {aluno.nome}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Código {aluno.codigo}
        {!aluno.ativo && <strong className="text-vinho"> · INATIVO</strong>}. Nome, turma da Mhund e responsável financeiro da Mhund
        seguem vindo de lá até a virada do cadastro; o restante desta página é do painel.
      </p>
      <Avisos salvo={salvo} erro={erro} />

      <section id="matricula" className="mt-6 rounded-xl border border-borda bg-white p-4">
        <h2 className="font-titulo text-xl text-verde-escuro">Matrícula</h2>
        <p className="mt-1 text-sm text-texto">
          {atual ? (
            <>
              {ano}: <strong>{atual.turmas?.nome}</strong>
            </>
          ) : (
            <>Sem turma em {ano}.</>
          )}
          {(matriculas ?? [])
            .filter((m) => m.ano !== ano && m.ativa)
            .map((m) => (
              <span key={m.turma_id} className="text-texto-suave">
                {" "}
                · {m.ano}: {m.turmas?.nome}
              </span>
            ))}
        </p>
        {podeEditar && (
          <form action={matricularAluno} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="codigo" value={codigo} />
            <label className="min-w-64 flex-1">
              <span className="rotulo">Matricular ou trocar para a turma</span>
              <select name="turma_id" defaultValue="" required className="campo">
                <option value="" disabled>
                  Escolha…
                </option>
                {anos.map((a) => (
                  <optgroup key={a} label={String(a)}>
                    {(turmas ?? [])
                      .filter((t) => t.ano === a)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button className="botao-primario">Matricular</button>
          </form>
        )}
        <p className="mt-2 text-xs text-texto-suave">Trocar de turma no mesmo ano encerra a matrícula anterior (fica no histórico).</p>
      </section>

      <section id="dados" className="mt-6 rounded-xl border border-borda bg-white p-4">
        <h2 className="font-titulo text-xl text-verde-escuro">Dados do aluno</h2>
        <form action={salvarDadosAluno} className="mt-3 space-y-3">
          <input type="hidden" name="codigo" value={codigo} />
          <fieldset disabled={!podeEditar} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">Nome completo (vem da Mhund)</span>
                <input value={aluno.nome} readOnly className="campo bg-creme" />
              </label>
              <label className="block">
                <span className="rotulo">Nome social (quando houver)</span>
                <input name="nome_social" defaultValue={dados?.nome_social ?? ""} className="campo" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-6">
              <label className="block">
                <span className="rotulo">Sexo</span>
                <select name="sexo" defaultValue={dados?.sexo ?? ""} className="campo">
                  <option value="">—</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Nascimento</span>
                <input name="nascimento" type="date" defaultValue={dados?.nascimento ?? ""} className="campo" />
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo">Naturalidade (cidade/UF)</span>
                <input name="naturalidade" defaultValue={dados?.naturalidade ?? ""} className="campo" />
              </label>
              <label className="block sm:col-span-2">
                <span className="rotulo">Nacionalidade</span>
                <input name="nacionalidade" defaultValue={dados?.nacionalidade ?? "Brasileira"} className="campo" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">CPF</span>
                <input name="cpf" defaultValue={dados?.cpf ? formatarCpf(dados.cpf) : ""} inputMode="numeric" placeholder="000.000.000-00" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">RG</span>
                <input name="rg" defaultValue={dados?.rg ?? ""} className="campo" />
              </label>
            </div>
            <CamposEndereco inicial={dados ?? {}} />
            <p className="text-xs text-texto-suave">
              Telefone e e-mail do aluno: os do responsável financeiro
              {financeiro
                ? ` (${financeiro.nome}${financeiro.celular ? ` · ${exibirTelefone(financeiro.celular)}` : ""}${financeiro.email ? ` · ${financeiro.email}` : ""}).`
                : " — marque um responsável financeiro abaixo."}
            </p>
            {podeEditar && <button className="botao-primario">Salvar dados do aluno</button>}
          </fieldset>
        </form>
      </section>

      <section id="responsaveis" className="mt-6">
        <h2 className="font-titulo text-xl text-verde-escuro">Pais e responsáveis</h2>
        {daMhund.length > 0 && (
          <p className="mt-1 text-xs text-texto-suave">
            Responsável financeiro na Mhund (acesso ao app mantido pela sincronização):{" "}
            {daMhund.map((a) => `${a.nome ?? "—"} · ${exibirTelefone(a.telefone)}`).join("; ")}
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {lista.length === 0 && <li className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhum cadastrado no painel ainda.</li>}
          {lista.map((v) => {
            const r = v.responsaveis;
            return (
              <li key={r.id} id={`resp-${r.id}`} className="rounded-xl border border-borda bg-white p-4">
                <p className="text-sm">
                  <strong className="text-verde-escuro">{r.nome_social || r.nome}</strong>
                  <span className="text-texto-suave">
                    {" "}
                    · {v.parentesco === "outro" ? v.parentesco_descricao || "Outro" : PARENTESCOS[v.parentesco]}
                    {v.financeiro && " · responsável financeiro"}
                    {r.celular && ` · ${exibirTelefone(r.celular)}`}
                    {!v.acesso_app && " · sem acesso ao app"}
                  </span>
                </p>
                {podeEditar && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-bold text-verde-claro">Editar</summary>
                    <form action={salvarResponsavel} className="mt-3 space-y-3">
                      <input type="hidden" name="codigo" value={codigo} />
                      <input type="hidden" name="responsavel_id" value={r.id} />
                      <CamposResponsavel r={r} v={v} />
                      <p className="text-xs text-texto-suave">Os dados da pessoa valem para todos os filhos dela; o vínculo, só para este aluno.</p>
                      <button className="botao-primario">Salvar</button>
                    </form>
                    <form action={desvincularResponsavel} className="mt-2">
                      <input type="hidden" name="codigo" value={codigo} />
                      <input type="hidden" name="responsavel_id" value={r.id} />
                      <button className="text-xs text-vinho underline-offset-4 hover:underline">Desvincular deste aluno</button>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        {podeEditar && (
          <details className="mt-3 rounded-xl border border-borda bg-white p-4" open={lista.length === 0}>
            <summary className="cursor-pointer font-bold text-verde-escuro">+ Adicionar pai, mãe ou responsável</summary>
            <form action={adicionarResponsavel} className="mt-3 space-y-3">
              <input type="hidden" name="codigo" value={codigo} />
              <CamposResponsavel />
              <p className="text-xs text-texto-suave">
                Se o CPF já estiver cadastrado (irmão na escola), a pessoa existente é vinculada e os dados dela não são sobrescritos. Pela LDB
                (art. 12, VII), a escola informa pai e mãe, convivendo ou não com o aluno: desmarque o acesso ao app só com ordem judicial.
              </p>
              <button className="botao-primario">Adicionar</button>
            </form>
          </details>
        )}
      </section>
    </div>
  );
}
