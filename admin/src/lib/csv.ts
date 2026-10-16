// Leitura de CSV exportado por planilha ou sistema: separador ";" ou "," (detectado na 1ª linha), aspas,
// UTF-8 ou Windows-1252 (o padrão do Excel em português).

export function decodificar(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Caractere de substituição = não era UTF-8 válido: o arquivo veio em Windows-1252.
  const texto = utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
  return texto.replace(/^﻿/, "");
}

export function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

/** "Código do Aluno" → "codigo_do_aluno" */
export const chaveColuna = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
