import { useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';

const MARGEM = 4; // módulos de borda branca exigidos pelo padrão QR

/** QR desenhado com Views (sem módulo nativo): cada trecho escuro contínuo de uma linha vira um retângulo. */
export function CodigoQR({ valor, tamanho }: { valor: string; tamanho: number }) {
  const { modulo, total, trechos } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(valor);
    qr.make();
    const n = qr.getModuleCount();
    const modulo = Math.max(1, Math.floor(tamanho / (n + MARGEM * 2)));
    const trechos: { linha: number; coluna: number; largura: number }[] = [];
    for (let linha = 0; linha < n; linha++) {
      for (let coluna = 0; coluna < n; coluna++) {
        if (!qr.isDark(linha, coluna)) continue;
        let fim = coluna;
        while (fim + 1 < n && qr.isDark(linha, fim + 1)) fim++;
        trechos.push({ linha, coluna, largura: fim - coluna + 1 });
        coluna = fim;
      }
    }
    return { modulo, total: (n + MARGEM * 2) * modulo, trechos };
  }, [valor, tamanho]);

  return (
    <View style={{ width: total, height: total, backgroundColor: '#FFFFFF' }} accessibilityLabel="Código QR da carteirinha">
      {trechos.map((t) => (
        <View
          key={`${t.linha}-${t.coluna}`}
          style={{
            position: 'absolute',
            top: (t.linha + MARGEM) * modulo,
            left: (t.coluna + MARGEM) * modulo,
            width: t.largura * modulo,
            height: modulo,
            backgroundColor: '#000000',
          }}
        />
      ))}
    </View>
  );
}
