"use client";

import { useActionState, useRef, useState } from "react";
import { salvarPost, type EstadoFormulario } from "@/app/(painel)/actions";
import { CATEGORIAS, ORDEM_CATEGORIAS, type Categoria } from "@/lib/categorias";
import type { ConfigSupabase } from "@/lib/config";
import { criarClienteNavegador } from "@/lib/supabase/client";

const BUCKET = "post-imagens";
const LADO_MAXIMO = 1600;

export type ImagemPost = { storage_path: string; largura: number | null; altura: number | null };

export type PostInicial = {
  id: string;
  categoria: Categoria;
  titulo: string;
  corpo: string;
  data_evento: string | null;
  fixado: boolean;
  status: "rascunho" | "publicado";
  push_enviado_em: string | null;
  imagens: ImagemPost[];
  turmas: string[] | null;
};

function urlPublica(supabaseUrl: string, caminho: string) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${caminho}`;
}

/** "2026-10-05T14:30:00Z" -> "2026-10-05T11:30" no fuso do navegador (para <input type=datetime-local>). */
function paraCampoLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Reduz fotos de celular (5–12 MB) para JPEG de até 1600px: economiza dados das famílias. */
async function redimensionar(arquivo: File): Promise<{ blob: Blob; largura: number; altura: number }> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao converter imagem"))), "image/jpeg", 0.85),
  );
  return { blob, largura, altura };
}

export function PostForm({
  inicial,
  turmasDisponiveis,
  supabase: configSupabase,
}: {
  inicial?: PostInicial;
  turmasDisponiveis: string[];
  supabase: ConfigSupabase;
}) {
  const [estado, acao, salvando] = useActionState<EstadoFormulario, FormData>(salvarPost, {});
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? "comunicado");
  const [imagens, setImagens] = useState<ImagemPost[]>(inicial?.imagens ?? []);
  const [enviando, setEnviando] = useState(0);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [dataLocal, setDataLocal] = useState(paraCampoLocal(inicial?.data_evento ?? null));
  const inputArquivos = useRef<HTMLInputElement>(null);

  const jaNotificado = Boolean(inicial?.push_enviado_em);
  // Campos controlados: o React 19 limpa formulários não controlados após a action,
  // o que apagaria o texto digitado quando o servidor devolve um erro de validação.
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [corpo, setCorpo] = useState(inicial?.corpo ?? "");
  const [fixado, setFixado] = useState(inicial?.fixado ?? false);
  // null = todas as famílias (público, inclusive visitantes sem login).
  const [turmas, setTurmas] = useState<string[] | null>(inicial?.turmas ?? null);
  // Editar algo já publicado não dispara push por padrão; só se marcado explicitamente.
  const [enviarPush, setEnviarPush] = useState(!inicial || inicial.status !== "publicado");
  const mostrarData = categoria === "evento" || categoria === "lembrete" || dataLocal !== "";

  async function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErroUpload(null);
    const supabase = criarClienteNavegador(configSupabase);
    const lista = Array.from(arquivos);
    setEnviando((n) => n + lista.length);

    for (const arquivo of lista) {
      try {
        const { blob, largura, altura } = await redimensionar(arquivo);
        const agora = new Date();
        const caminho = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (error) throw error;
        setImagens((atuais) => [...atuais, { storage_path: caminho, largura, altura }]);
      } catch (e) {
        console.error(e);
        setErroUpload(`Não foi possível enviar "${arquivo.name}".`);
      } finally {
        setEnviando((n) => n - 1);
      }
    }
    if (inputArquivos.current) inputArquivos.current.value = "";
  }

  function mover(indice: number, delta: number) {
    setImagens((atuais) => {
      const alvo = indice + delta;
      if (alvo < 0 || alvo >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];
      return copia;
    });
  }

  const ocupado = salvando || enviando > 0;

  return (
    <form action={acao} className="grid gap-8 lg:grid-cols-[1fr_280px]">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="imagens" value={JSON.stringify(imagens)} />
      <input type="hidden" name="turmas" value={JSON.stringify(turmas)} />
      <input type="hidden" name="data_evento" value={dataLocal ? new Date(dataLocal).toISOString() : ""} />

      <div className="space-y-6">
        <fieldset>
          <legend className="rotulo">Categoria</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ORDEM_CATEGORIAS.map((c) => (
              <label
                key={c}
                className={`cursor-pointer rounded-lg border p-3 transition ${categoria === c ? "border-verde-medio bg-verde-medio/5 ring-2 ring-verde-medio/20" : "border-borda bg-white hover:border-verde-claro"}`}
              >
                <input
                  type="radio"
                  name="categoria"
                  value={c}
                  checked={categoria === c}
                  onChange={() => setCategoria(c)}
                  className="sr-only"
                />
                <span className={`mb-2 block h-1.5 w-8 rounded-full ${CATEGORIAS[c].classe}`} />
                <span className="block text-sm font-bold text-verde-escuro">{CATEGORIAS[c].rotulo}</span>
                <span className="block text-[11px] leading-tight text-texto-suave">{CATEGORIAS[c].descricao}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="rotulo">Título</span>
          <input
            name="titulo"
            required
            maxLength={160}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião de pais do 3º bimestre"
            className="campo font-titulo !text-xl"
          />
        </label>

        <label className="block">
          <span className="rotulo">Texto</span>
          <textarea
            name="corpo"
            rows={8}
            maxLength={10000}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva o comunicado. As primeiras linhas aparecem na notificação."
            className="campo resize-y leading-relaxed"
          />
        </label>

        {mostrarData && (
          <label className="block">
            <span className="rotulo">Data e hora {categoria === "evento" ? "do evento" : "(opcional)"}</span>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={dataLocal}
                onChange={(e) => setDataLocal(e.target.value)}
                className="campo max-w-xs"
              />
              {dataLocal && (
                <button type="button" onClick={() => setDataLocal("")} className="text-sm text-texto-suave underline">
                  limpar
                </button>
              )}
            </div>
          </label>
        )}

        <div>
          <span className="rotulo">Fotos {categoria === "galeria" && "(obrigatório no álbum)"}</span>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {imagens.map((img, i) => (
              <div key={img.storage_path} className="group relative overflow-hidden rounded-lg border border-borda bg-creme">
                {/* eslint-disable-next-line @next/next/no-img-element -- já redimensionada e servida pelo Supabase */}
                <img src={urlPublica(configSupabase.url, img.storage_path)} alt="" className="aspect-square w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-verde-escuro/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    CAPA
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-verde-escuro/80 px-1 py-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button type="button" onClick={() => mover(i, -1)} className="px-2" aria-label="Mover para a esquerda">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagens((a) => a.filter((_, j) => j !== i))}
                    className="px-2 text-xs font-bold"
                  >
                    Remover
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} className="px-2" aria-label="Mover para a direita">
                    →
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => inputArquivos.current?.click()}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-borda bg-white text-texto-suave transition hover:border-verde-claro hover:text-verde-medio"
            >
              <span className="text-3xl leading-none">+</span>
              <span className="mt-1 text-xs font-bold">{enviando > 0 ? `Enviando ${enviando}…` : "Adicionar fotos"}</span>
            </button>
          </div>
          <input
            ref={inputArquivos}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => adicionarFotos(e.target.files)}
          />
          {erroUpload && <p className="mt-2 text-sm text-vinho">{erroUpload}</p>}
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-4 rounded-xl border border-borda bg-white p-5">
          <p className="font-titulo text-lg text-verde-escuro">Publicação</p>

          <fieldset className="space-y-2 text-sm">
            <legend className="rotulo">Quem vê</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={turmas === null}
                onChange={() => setTurmas(null)}
                className="h-4 w-4 accent-verde-medio"
              />
              <span>Todos (mural público)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={turmas !== null}
                onChange={() => setTurmas(turmas ?? [])}
                disabled={turmasDisponiveis.length === 0}
                className="h-4 w-4 accent-verde-medio"
              />
              <span>Só famílias de turmas específicas</span>
            </label>
            {turmasDisponiveis.length === 0 && (
              <p className="text-xs text-texto-suave">Cadastre alunos na tabela de alunos para segmentar por turma.</p>
            )}
            {turmas !== null && (
              <div className="ml-6 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-borda p-2">
                {turmasDisponiveis.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={turmas.includes(t)}
                      onChange={(e) =>
                        setTurmas(e.target.checked ? [...turmas, t] : turmas.filter((x) => x !== t))
                      }
                      className="h-3.5 w-3.5 accent-verde-medio"
                    />
                    {t}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="fixado"
              checked={fixado}
              onChange={(e) => setFixado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-dourado" />
            <span>
              <strong className="block text-verde-escuro">Fixar no topo</strong>
              <span className="text-texto-suave">Fica em destaque acima das demais.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="enviar_push"
              checked={enviarPush}
              onChange={(e) => setEnviarPush(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-verde-medio"
            />
            <span>
              <strong className="block text-verde-escuro">
                {jaNotificado ? "Notificar novamente" : "Enviar notificação"}
              </strong>
              <span className="text-texto-suave">
                {jaNotificado
                  ? "As famílias já foram avisadas desta publicação."
                  : turmas
                    ? "Push só para responsáveis logados dessas turmas."
                    : "Push para todos os celulares com o app."}
              </span>
            </span>
          </label>

          {estado.erro && (
            <p role="alert" className="rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
              {estado.erro}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button type="submit" name="acao" value="publicar" disabled={ocupado} className="botao-primario">
              {salvando ? "Salvando…" : inicial?.status === "publicado" ? "Salvar alterações" : "Publicar agora"}
            </button>
            <button type="submit" name="acao" value="rascunho" disabled={ocupado} className="botao-secundario">
              {inicial?.status === "publicado" ? "Despublicar (rascunho)" : "Salvar rascunho"}
            </button>
          </div>
          {enviando > 0 && <p className="text-xs text-texto-suave">Aguarde o envio das fotos para salvar.</p>}
        </div>
      </aside>
    </form>
  );
}
