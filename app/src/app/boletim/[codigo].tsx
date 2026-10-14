import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MensagemErro } from '@/components/Formulario';
import { formatarNota } from '@/lib/avaliacao';
import { boletimDoAluno, turmaAtual } from '@/lib/escola';
import { cores, fontes } from '@/lib/theme';

type Resultado = Awaited<ReturnType<typeof boletimDoAluno>> & { turma: string; ano: number };

export default function Boletim() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [dados, setDados] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    turmaAtual(codigo)
      .then(async (turma) => {
        if (!turma) throw new Error('O aluno ainda não está em uma turma deste ano letivo.');
        const b = await boletimDoAluno(codigo, turma);
        if (ativo) setDados({ ...b, turma: turma.nome, ano: turma.ano });
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar o boletim.'));
    return () => {
      ativo = false;
    };
  }, [codigo]);

  if (erro) {
    return (
      <View style={styles.conteudo}>
        <MensagemErro texto={erro} />
      </View>
    );
  }
  if (!dados) return <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 48 }} />;

  const { regra, disciplinas, publicados } = dados;
  const cor = (n: number | null) => (n === null || !regra ? cores.textoSuave : n < regra.media_aprovacao ? cores.vinho : cores.verdeEscuro);

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Text style={styles.turma}>
        {dados.turma} · {dados.ano}
      </Text>

      {(!regra || publicados.length === 0) && (
        <Text style={styles.aviso}>O boletim aparece aqui assim que a escola publicar o fechamento do bimestre.</Text>
      )}

      {regra?.descritivo
        ? disciplinas.map((d) => (
            <View key={d.disciplina} style={styles.cartao}>
              <Text style={styles.disciplina}>{d.disciplina}</Text>
              {d.bimestres
                .filter((b) => b.publicado && b.parecer)
                .map((b) => (
                  <View key={b.numero} style={{ gap: 2 }}>
                    <Text style={styles.rotulo}>{b.numero}º BIMESTRE</Text>
                    <Text style={styles.texto}>{b.parecer}</Text>
                  </View>
                ))}
              {!d.bimestres.some((b) => b.publicado && b.parecer) && <Text style={styles.detalhe}>Sem parecer publicado.</Text>}
            </View>
          ))
        : publicados.length > 0 &&
          disciplinas.map((d) => (
            <View key={d.disciplina} style={styles.cartao}>
              <Text style={styles.disciplina}>{d.disciplina}</Text>
              <View style={styles.linha}>
                {d.bimestres.map((b) => {
                  const nota = b.publicado ? b.resultado.final : null;
                  return (
                    <View key={b.numero} style={styles.celula}>
                      <Text style={styles.rotulo}>{b.numero}º BIM.</Text>
                      <Text style={[styles.nota, { color: cor(nota) }]}>{b.publicado ? formatarNota(nota) : '·'}</Text>
                      {b.publicado && b.resultado.emRecuperacao && b.resultado.recuperacao !== null && <Text style={styles.detalhe}>após rec.</Text>}
                    </View>
                  );
                })}
                <View style={[styles.celula, styles.final]}>
                  <Text style={styles.rotulo}>FINAL</Text>
                  <Text style={[styles.nota, { color: cor(d.anual.media) }]}>{formatarNota(d.anual.media)}</Text>
                </View>
              </View>
            </View>
          ))}

      {regra && !regra.descritivo && publicados.length > 0 && (
        <Text style={styles.nota_rodape}>
          Média para aprovação: {formatarNota(regra.media_aprovacao)}. Abaixo dela, o aluno faz recuperação no bimestre; se a nota da
          recuperação for maior, ela passa a valer. A média final aparece quando os 4 bimestres estiverem fechados.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 16, gap: 12 },
  turma: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, textAlign: 'center' },
  aviso: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave, textAlign: 'center', marginTop: 24 },
  cartao: { backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 10 },
  disciplina: { fontFamily: fontes.titulo, fontSize: 17, color: cores.verdeEscuro },
  linha: { flexDirection: 'row', gap: 6 },
  celula: { flex: 1, alignItems: 'center', backgroundColor: cores.creme, borderRadius: 8, paddingVertical: 8 },
  final: { backgroundColor: '#0F3D2414' },
  rotulo: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1, color: cores.textoSuave },
  nota: { fontFamily: fontes.titulo, fontSize: 20 },
  detalhe: { fontFamily: fontes.corpo, fontSize: 10, color: cores.textoSuave },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21, color: cores.texto },
  nota_rodape: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.texto, backgroundColor: cores.creme, borderRadius: 10, padding: 12 },
});
