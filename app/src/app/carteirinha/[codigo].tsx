import { useCallback, useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, AppState, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CodigoQR } from '@/components/CodigoQR';
import { MensagemErro } from '@/components/Formulario';
import { Tricolor } from '@/components/Tricolor';
import { buscarFilho, enderecoCarteirinha, type Aluno } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';

// O código vale ~60 s no servidor (janela atual + anterior); renovar a cada 20 s deixa folga para relógio e rede.
const RENOVAR_MS = 20_000;

export default function Carteirinha() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { pronto, usuarioId } = useSessao();
  const { width } = useWindowDimensions();
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const renovar = useCallback(() => {
    enderecoCarteirinha(codigo)
      .then((e) => {
        setEndereco(e);
        setErro(null);
      })
      .catch((e: Error) => {
        setEndereco(null);
        setErro(e.message);
      });
  }, [codigo]);

  useEffect(() => {
    if (!usuarioId) return;
    buscarFilho(codigo).then(setAluno, (e: Error) => setErro(e.message));
    renovar();
    const intervalo = setInterval(renovar, RENOVAR_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && renovar());
    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [usuarioId, codigo, renovar]);

  if (pronto && !usuarioId) return <Redirect href="/entrar" />;

  const tamanhoQR = Math.min(width - 96, 280);
  const ano = new Date().getFullYear();

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={styles.cartao}>
        <View style={styles.topo}>
          <View style={styles.brasao}>
            <Image source={require('../../../assets/brasao.png')} style={{ width: 26, height: 32 }} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.escola}>Colégio Zampieri</Text>
            <Text style={styles.sobretitulo}>CARTEIRINHA DO ALUNO</Text>
          </View>
        </View>
        <Tricolor />

        <View style={styles.corpo}>
          {aluno ? (
            <View style={{ gap: 2 }}>
              <Text style={styles.nome}>{aluno.nome}</Text>
              <Text style={styles.detalhe}>{aluno.turma}</Text>
              <Text style={styles.detalhe}>
                Código {aluno.codigo} · Ano letivo {ano}
              </Text>
            </View>
          ) : (
            !erro && <ActivityIndicator color={cores.verdeMedio} />
          )}

          <View style={[styles.areaQR, { minHeight: tamanhoQR + 16 }]}>
            {endereco ? <CodigoQR valor={endereco} tamanho={tamanhoQR} /> : !erro && <ActivityIndicator color={cores.verdeMedio} />}
          </View>
          <MensagemErro texto={erro} />
          <Text style={styles.nota}>
            O código muda a cada 30 segundos: só vale aberto no app, não por foto ou print.
          </Text>
        </View>
      </View>

      <Text style={styles.aviso}>
        Identifica o aluno na escola, em excursões, eventos e parceiros. Não substitui a Carteira de Identificação
        Estudantil (CIE), exigida por lei para meia-entrada.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 20, gap: 16 },
  cartao: {
    backgroundColor: cores.branco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cores.verdeEscuro, padding: 16 },
  brasao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escola: { fontFamily: fontes.titulo, fontSize: 18, color: cores.branco },
  sobretitulo: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 2.2, color: cores.douradoClaro },
  corpo: { padding: 20, gap: 16 },
  nome: { fontFamily: fontes.titulo, fontSize: 24, lineHeight: 30, color: cores.verdeEscuro },
  detalhe: { fontFamily: fontes.corpo, fontSize: 15, color: cores.textoSuave },
  areaQR: { alignItems: 'center', justifyContent: 'center' },
  nota: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.textoSuave, textAlign: 'center' },
  aviso: { fontFamily: fontes.corpo, fontSize: 12, lineHeight: 18, color: cores.textoSuave, textAlign: 'center' },
});
