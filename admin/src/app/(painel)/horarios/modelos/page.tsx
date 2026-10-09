import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { hhmm, type AulaModelo } from "@/lib/horarios";
import { criarModelo, excluirModelo, salvarModelo } from "../actions";

const LINHAS_EXTRAS = 2;

export default async function PaginaModelos({ searchParams }: PageProps<"/horarios/modelos">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const [{ data: modelos }, { data: aulasBrutas }, { data: turmas }] = await Promise.all([
    supabase.from("modelos_horario").select("id,nome").order("id"),
    supabase.from("modelo_horario_aulas").select("modelo_id,numero,inicio,fim").order("numero"),
    supabase.from("turmas").select("id,modelo_horario_id").eq("ativa", true),
  ]);
  const aulas = (aulasBrutas ?? []) as AulaModelo[];

  return (
    <div>
      <Link href="/horarios" className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Horários
      </Link>
      <h1 className="mt-2 font-titulo text-3xl text-verde-escuro">Modelos de horário</h1>
      <p className="mt-1 text-sm text-texto-suave">
        O horário de início e fim de cada aula. Cada turma usa um modelo; turmas com horário diferente ganham um modelo
        próprio. Intervalos aparecem sozinhos no espaço entre uma aula e outra. Para tirar uma aula, apague os dois
        horários dela.
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(modelos ?? []).map((m) => {
          const doModelo = aulas.filter((a) => a.modelo_id === m.id);
          const emUso = (turmas ?? []).filter((t) => t.modelo_horario_id === m.id).length;
          return (
            <section key={m.id} className="rounded-xl border border-borda bg-white p-4">
              <form action={salvarModelo} className="space-y-3">
                <input type="hidden" name="modelo_id" value={m.id} />
                <label className="block">
                  <span className="rotulo">Nome</span>
                  <input name="nome" defaultValue={m.nome} className="campo" required maxLength={60} />
                </label>
                <p className="text-xs text-texto-suave">
                  Usado por {emUso} turma{emUso === 1 ? "" : "s"}.
                </p>
                <div className="space-y-1.5">
                  {[...doModelo, ...Array.from({ length: LINHAS_EXTRAS }, () => null)].map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 text-right text-xs font-bold text-texto-suave">{a ? `${a.numero}ª` : "+"}</span>
                      <input type="time" name="inicio" defaultValue={a ? hhmm(a.inicio) : ""} className="campo !py-1.5" aria-label="Início" />
                      <span className="text-texto-suave">–</span>
                      <input type="time" name="fim" defaultValue={a ? hhmm(a.fim) : ""} className="campo !py-1.5" aria-label="Fim" />
                    </div>
                  ))}
                </div>
                <button className="botao-primario w-full sm:w-auto">Salvar modelo</button>
              </form>
              {emUso === 0 && (
                <form action={excluirModelo} className="mt-3">
                  <input type="hidden" name="modelo_id" value={m.id} />
                  <button className="text-xs text-vinho underline-offset-4 hover:underline">Excluir modelo</button>
                </form>
              )}
            </section>
          );
        })}

        <section className="rounded-xl border border-dashed border-borda bg-white/60 p-4">
          <h2 className="font-titulo text-xl text-verde-escuro">Novo modelo</h2>
          <form action={criarModelo} className="mt-3 space-y-3">
            <label className="block">
              <span className="rotulo">Nome</span>
              <input name="nome" placeholder="Ex.: Manhã — Infantil" className="campo" required maxLength={60} />
            </label>
            <label className="block">
              <span className="rotulo">Começar copiando de</span>
              <select name="copiar_de" className="campo" defaultValue={modelos?.[0]?.id ?? ""}>
                <option value="">Nenhum (em branco)</option>
                {(modelos ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
            <button className="botao-secundario">Criar modelo</button>
          </form>
        </section>
      </div>
    </div>
  );
}
