"use client";

import { useState } from "react";

type Endereco = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string };

/** Endereço com busca pelo CEP (ViaCEP, serviço público e gratuito dos Correios/IBGE). */
export function CamposEndereco({ inicial }: { inicial: Partial<Record<keyof Endereco, string | null>> }) {
  const [e, setE] = useState<Endereco>({
    cep: inicial.cep ? inicial.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "",
    logradouro: inicial.logradouro ?? "",
    numero: inicial.numero ?? "",
    complemento: inicial.complemento ?? "",
    bairro: inicial.bairro ?? "",
    cidade: inicial.cidade ?? "",
    uf: inicial.uf ?? "",
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const mudar = (campo: keyof Endereco) => (ev: React.ChangeEvent<HTMLInputElement>) => setE((x) => ({ ...x, [campo]: ev.target.value }));

  async function buscar() {
    const cep = e.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setAviso("O CEP tem 8 números.");
      return;
    }
    setBuscando(true);
    setAviso(null);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!r.ok || d.erro) {
        setAviso("CEP não encontrado. Preencha o endereço à mão.");
        return;
      }
      setE((x) => ({ ...x, logradouro: d.logradouro || x.logradouro, bairro: d.bairro || x.bairro, cidade: d.localidade || x.cidade, uf: d.uf || x.uf }));
      setAviso("Endereço preenchido pelo CEP. Complete o número.");
    } catch {
      setAviso("Não foi possível consultar o CEP agora. Preencha à mão.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <label className="block sm:col-span-2">
        <span className="rotulo">CEP</span>
        <span className="flex gap-2">
          <input
            name="cep"
            value={e.cep}
            onChange={mudar("cep")}
            onBlur={() => e.cep.replace(/\D/g, "").length === 8 && !e.logradouro && void buscar()}
            inputMode="numeric"
            placeholder="00000-000"
            className="campo"
          />
          <button type="button" onClick={() => void buscar()} disabled={buscando} className="botao-secundario !px-3 whitespace-nowrap">
            {buscando ? "…" : "Buscar"}
          </button>
        </span>
      </label>
      <label className="block sm:col-span-4">
        <span className="rotulo">Logradouro</span>
        <input name="logradouro" value={e.logradouro} onChange={mudar("logradouro")} className="campo" />
      </label>
      <label className="block sm:col-span-1">
        <span className="rotulo">Número</span>
        <input name="numero" value={e.numero} onChange={mudar("numero")} className="campo" />
      </label>
      <label className="block sm:col-span-2">
        <span className="rotulo">Complemento</span>
        <input name="complemento" value={e.complemento} onChange={mudar("complemento")} className="campo" />
      </label>
      <label className="block sm:col-span-3">
        <span className="rotulo">Bairro</span>
        <input name="bairro" value={e.bairro} onChange={mudar("bairro")} className="campo" />
      </label>
      <label className="block sm:col-span-4">
        <span className="rotulo">Cidade</span>
        <input name="cidade" value={e.cidade} onChange={mudar("cidade")} className="campo" />
      </label>
      <label className="block sm:col-span-2">
        <span className="rotulo">UF</span>
        <input name="uf" value={e.uf} onChange={mudar("uf")} maxLength={2} className="campo uppercase" />
      </label>
      {aviso && <p className="text-xs text-texto-suave sm:col-span-6">{aviso}</p>}
    </div>
  );
}
