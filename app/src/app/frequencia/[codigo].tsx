import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MensagemErro } from '@/components/Formulario';
import { FREQUENCIA_MINIMA, frequenciaDoAluno, turmaAtual } from '@/lib/escola';
import { cores, fontes } from '@/lib/theme';

type Resultado = Awaited<ReturnType<typeof frequenciaDoAluno>> & { turma: string; ano: number };

export default function Frequencia() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    turmaAtual(codigo)
      .then(async (turma) => {
        if (!turma) throw new Error('O aluno ainda não está em uma turma deste ano letivo.');
        const f = await frequenciaDoAluno(codigo, turma.turma_id, turma.ano);
        if (ativo) setResultado({ ...f, turma: turma.nome, ano: turma.ano });
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
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
  if (!resultado) return <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 48 }} />;

  const { total, disciplinas } = resultado;
  const abaixo = total.aulas > 0 && total.percentual < FREQUENCIA_MINIMA;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <Text style={styles.turma}>
        {resultado.turma} · {resultado.ano}
      </Text>

      <View style={[styles.total, abaixo && { borderColor: cores.vinho }]}>
        <Text style={styles.rotulo}>FREQUÊNCIA NO ANO</Text>
        <Text style={[styles.percentual, { color: abaixo ? cores.vinho : cores.verdeClaro }]}>{total.aulas ? `${total.percentual}%` : '—'}</Text>
        <Text style={styles.detalhe}>
          {total.aulas
            ? `${total.faltas + total.justificadas} ausência${total.faltas + total.justificadas === 1 ? '' : 's'} em ${total.aulas} aulas` +
              (total.justificadas ? ` (${total.justificadas} justificada${total.justificadas === 1 ? '' : 's'})` : '')
            : 'Nenhuma chamada registrada ainda.'}
        </Text>
      </View>

      <Text style={styles.nota}>
        O mínimo exigido é {FREQUENCIA_MINIMA}% no total e em cada disciplina. Falta justificada também conta como ausência; dúvidas sobre
        abono, fale com a coordenação.
      </Text>

      {disciplinas.length > 0 && (
        <View style={styles.lista}>
          {disciplinas.map((d, i) => {
            const baixa = d.percentual < FREQUENCIA_MINIMA;
            return (
              <View key={d.disciplina} style={[styles.linha, i > 0 && styles.divisor]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disciplina}>{d.disciplina}</Text>
                  <Text style={styles.detalhe}>
                    {d.faltas + d.justificadas} ausência{d.faltas + d.justificadas === 1 ? '' : 's'} em {d.aulas} aula{d.aulas === 1 ? '' : 's'}
                    {d.justificadas ? ` · ${d.justificadas} justificada${d.justificadas === 1 ? '' : 's'}` : ''}
                  </Text>
                </View>
                <Text style={[styles.pct, baixa ? styles.pctBaixa : styles.pctOk]}>{d.percentual}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 16, gap: 14 },
  turma: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, textAlign: 'center' },
  total: { backgroundColor: cores.branco, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 18, alignItems: 'center', gap: 2 },
  rotulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 2, color: cores.dourado },
  percentual: { fontFamily: fontes.titulo, fontSize: 44 },
  detalhe: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave },
  nota: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.texto, backgroundColor: cores.creme, borderRadius: 10, padding: 12 },
  lista: { backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  divisor: { borderTopWidth: 1, borderTopColor: cores.borda },
  disciplina: { fontFamily: fontes.corpoNegrito, fontSize: 15, color: cores.verdeEscuro },
  pct: { fontFamily: fontes.corpoNegrito, fontSize: 14, width: 56, textAlign: 'center', borderRadius: 6, overflow: 'hidden', paddingVertical: 4 },
  pctOk: { color: cores.verdeClaro, backgroundColor: '#2D7A4E1F' },
  pctBaixa: { color: cores.branco, backgroundColor: cores.vinho },
});
