import Image from "next/image";
import { exigirAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { BUCKET_FOTOS_ALUNOS, MOTIVOS_RECUSA_FOTO } from "@/lib/fotos";
import { revisarFoto } from "./actions";

type Pendente = {
  id: string;
  caminho: string;
  enviado_em: string;
  aluno_codigo: string;
  alunos: { nome: string; turma: string } | null;
};

export default async function PaginaFotos() {
  const { supabase } = await exigirAdmin();
  const { data, error } = await supabase
    .from("aluno_fotos")
    .select("id,caminho,enviado_em,aluno_codigo,alunos(nome,turma)")
    .eq("status", "pendente")
    .order("enviado_em")
    .limit(60)
    .overrideTypes<Pendente[], { merge: false }>();

  const pendentes = data ?? [];
  const urls = new Map<string, string>();
  if (pendentes.length > 0) {
    const { data: assinadas } = await supabase.storage
      .from(BUCKET_FOTOS_ALUNOS)
      .createSignedUrls(pendentes.map((p) => p.caminho), 60 * 30);
    assinadas?.forEach((a) => a.path && a.signedUrl && urls.set(a.path, a.signedUrl));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-titulo text-3xl text-verde-escuro">Fotos da carteirinha</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Fotos enviadas pelos responsáveis. Só a foto aprovada aparece na carteirinha do aluno; quem enviou recebe uma
          notificação com o resultado.
        </p>
      </div>

      {error && <p className="text-sm text-vinho">Não foi possível carregar as fotos.</p>}
      {!error && pendentes.length === 0 && (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhuma foto aguardando aprovação.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pendentes.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-xl border border-borda bg-white">
            <div className="relative aspect-[3/4] bg-creme">
              {urls.get(p.caminho) ? (
                <Image src={urls.get(p.caminho)!} alt={`Foto enviada para ${p.alunos?.nome ?? "aluno"}`} fill unoptimized className="object-cover" />
              ) : (
                <p className="p-4 text-sm text-texto-suave">Imagem indisponível.</p>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="font-titulo text-lg leading-snug text-verde-escuro">{p.alunos?.nome ?? `Aluno ${p.aluno_codigo}`}</p>
                <p className="text-sm text-texto-suave">
                  {p.alunos?.turma} · código {p.aluno_codigo}
                </p>
                <p className="text-xs text-texto-suave">Enviada em {formatarDataHora(p.enviado_em)}</p>
              </div>
              <form action={revisarFoto}>
                <input type="hidden" name="id" value={p.id} />
                <button name="acao" value="aprovar" className="botao-primario w-full">
                  Aprovar
                </button>
              </form>
              <form action={revisarFoto} className="flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <select name="motivo" className="campo flex-1 !py-2 text-sm" defaultValue={MOTIVOS_RECUSA_FOTO[0]} aria-label="Motivo da recusa">
                  {MOTIVOS_RECUSA_FOTO.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button name="acao" value="recusar" className="botao-secundario !px-3 text-vinho">
                  Recusar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
