"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { ehCategoria } from "@/lib/categorias";
import { enviarPushDoPost } from "@/lib/push";

const BUCKET = "post-imagens";

export type EstadoFormulario = { erro?: string };

type ImagemEnviada = { storage_path: string; largura: number | null; altura: number | null };

function lerImagens(bruto: FormDataEntryValue | null): ImagemEnviada[] | null {
  try {
    const lista = JSON.parse(String(bruto ?? "[]"));
    if (!Array.isArray(lista) || lista.length > 30) return null;
    return lista.map((i) => {
      if (typeof i?.storage_path !== "string" || !/^[\w/-]+\.(jpe?g|png|webp)$/i.test(i.storage_path)) {
        throw new Error("caminho inválido");
      }
      return {
        storage_path: i.storage_path,
        largura: Number.isFinite(i.largura) ? Math.round(i.largura) : null,
        altura: Number.isFinite(i.altura) ? Math.round(i.altura) : null,
      };
    });
  } catch {
    return null;
  }
}

export async function salvarPost(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const { supabase, userId } = await exigirAdmin();

  const id = String(formData.get("id") ?? "") || null;
  const categoria = formData.get("categoria");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const dataEventoBruta = String(formData.get("data_evento") ?? "");
  const fixado = formData.get("fixado") === "on";
  const publicar = formData.get("acao") === "publicar";
  const enviarPush = publicar && formData.get("enviar_push") === "on";
  const imagens = lerImagens(formData.get("imagens"));

  if (!ehCategoria(categoria)) return { erro: "Escolha uma categoria." };
  if (!titulo) return { erro: "O título é obrigatório." };
  if (titulo.length > 160) return { erro: "O título deve ter no máximo 160 caracteres." };
  if (corpo.length > 10000) return { erro: "O texto deve ter no máximo 10.000 caracteres." };
  if (!imagens) return { erro: "Não foi possível ler as fotos enviadas. Tente novamente." };
  if (categoria === "galeria" && imagens.length === 0) return { erro: "Adicione ao menos uma foto ao álbum." };

  // O navegador converte a data local para ISO (UTC) antes de enviar.
  const dataEvento = dataEventoBruta ? new Date(dataEventoBruta) : null;
  if (dataEvento && Number.isNaN(dataEvento.getTime())) return { erro: "Data do evento inválida." };

  let anterior: { status: string; publicado_em: string | null; imagens: string[] } | null = null;
  if (id) {
    const { data, error } = await supabase
      .from("posts")
      .select("status, publicado_em, post_imagens(storage_path)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return { erro: "Publicação não encontrada." };
    anterior = {
      status: data.status,
      publicado_em: data.publicado_em,
      imagens: (data.post_imagens as { storage_path: string }[]).map((i) => i.storage_path),
    };
  }

  const jaPublicado = anterior?.status === "publicado";
  const campos = {
    categoria,
    titulo,
    corpo,
    data_evento: dataEvento?.toISOString() ?? null,
    fixado,
    status: publicar ? "publicado" : "rascunho",
    publicado_em: publicar ? (jaPublicado && anterior?.publicado_em ? anterior.publicado_em : new Date().toISOString()) : null,
  };

  let postId = id;
  if (id) {
    const { error } = await supabase.from("posts").update(campos).eq("id", id);
    if (error) return { erro: `Erro ao salvar: ${error.message}` };
  } else {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...campos, autor_id: userId })
      .select("id")
      .single();
    if (error) return { erro: `Erro ao salvar: ${error.message}` };
    postId = data.id;
  }

  // Substitui o conjunto de fotos pela ordem atual do formulário.
  const { error: erroApagar } = await supabase.from("post_imagens").delete().eq("post_id", postId!);
  if (erroApagar) return { erro: `Erro ao atualizar fotos: ${erroApagar.message}` };
  if (imagens.length > 0) {
    const { error } = await supabase
      .from("post_imagens")
      .insert(imagens.map((img, posicao) => ({ ...img, post_id: postId, posicao })));
    if (error) return { erro: `Erro ao salvar fotos: ${error.message}` };
  }
  const removidas = (anterior?.imagens ?? []).filter((p) => !imagens.some((i) => i.storage_path === p));
  if (removidas.length > 0) await supabase.storage.from(BUCKET).remove(removidas);

  let aviso = "";
  if (enviarPush) {
    try {
      const r = await enviarPushDoPost({ id: postId!, categoria, titulo, corpo });
      aviso = `&push=${r.enviados}&falhas=${r.falhas}`;
    } catch (e) {
      console.error("[push]", e);
      aviso = "&push=erro";
    }
  }

  revalidatePath("/");
  redirect(`/?salvo=${publicar ? "publicado" : "rascunho"}${aviso}`);
}

export async function excluirPost(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: imagens } = await supabase.from("post_imagens").select("storage_path").eq("post_id", id);
  await supabase.from("posts").delete().eq("id", id);
  if (imagens && imagens.length > 0) {
    await supabase.storage.from(BUCKET).remove(imagens.map((i) => i.storage_path));
  }

  revalidatePath("/");
  redirect("/?salvo=excluido");
}

export async function alternarFixado(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const fixar = formData.get("fixar") === "1";
  await supabase.from("posts").update({ fixado: fixar }).eq("id", id);
  revalidatePath("/");
}
