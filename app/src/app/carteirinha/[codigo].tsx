import { useCallback, useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CodigoQR } from '@/components/CodigoQR';
import { MensagemErro } from '@/components/Formulario';
import { Tricolor } from '@/components/Tricolor';
import { buscarFilho, buscarFotoAluno, enderecoCarteirinha, enviarFotoAluno, type Aluno, type FotoAluno } from '@/lib/api';
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
  const [foto, setFoto] = useState<FotoAluno | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const carregarFoto = useCallback(() => {
    buscarFotoAluno(codigo).then(setFoto, (e: Error) => setErroFoto(e.message));
  }, [codigo]);

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
    carregarFoto();
    renovar();
    const intervalo = setInterval(renovar, RENOVAR_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && renovar());
    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [usuarioId, codigo, renovar, carregarFoto]);

  async function selecionarFoto(origem: 'camera' | 'galeria') {
    setErroFoto(null);
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 1 };
    if (origem === 'camera') {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        setErroFoto('Permita o acesso à câmera nas configurações do celular, ou escolha uma foto da galeria.');
        return;
      }
    }
    const resultado =
      origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
    if (resultado.canceled || !resultado.assets[0]) return;

    setEnviandoFoto(true);
    try {
      // 600 px de largura em JPEG: nítido na carteirinha e leve para enviar (~60–120 KB).
      const imagem = await ImageManipulator.manipulate(resultado.assets[0].uri).resize({ width: 600 }).renderAsync();
      const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!salva.base64) throw new Error('Não foi possível preparar a foto.');
      await enviarFotoAluno(codigo, salva.base64);
      carregarFoto();
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setEnviandoFoto(false);
    }
  }

  function pedirFoto() {
    const aviso =
      'Use uma foto recente, de frente, com o rosto bem visível. A secretaria confere antes de ela aparecer na carteirinha, e ela só é usada para identificar o aluno.';
    if (Platform.OS === 'web') {
      selecionarFoto('galeria');
      return;
    }
    Alert.alert('Foto da carteirinha', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Escolher da galeria', onPress: () => selecionarFoto('galeria') },
      { text: 'Tirar foto', onPress: () => selecionarFoto('camera') },
    ]);
  }

  if (pronto && !usuarioId) return <Redirect href="/entrar" />;

  const situacaoFoto = foto?.ultimoEnvio;

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
            <View style={styles.identificacao}>
              <Pressable onPress={pedirFoto} disabled={enviandoFoto} accessibilityRole="button" accessibilityLabel="Foto do aluno">
                <View style={styles.foto}>
                  {foto?.aprovadaUrl ? (
                    <Image source={{ uri: foto.aprovadaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Text style={styles.fotoInicial}>{aluno.nome.trim().charAt(0).toUpperCase()}</Text>
                  )}
                  {enviandoFoto && (
                    <View style={styles.fotoCarregando}>
                      <ActivityIndicator color={cores.branco} />
                    </View>
                  )}
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nome}>{aluno.nome}</Text>
                <Text style={styles.detalhe}>{aluno.turma}</Text>
                <Text style={styles.detalhe}>
                  Código {aluno.codigo} · Ano letivo {ano}
                </Text>
              </View>
            </View>
          ) : (
            !erro && <ActivityIndicator color={cores.verdeMedio} />
          )}

          {aluno && foto && (
            <View style={{ gap: 4 }}>
              {situacaoFoto?.status === 'pendente' && (
                <Text style={styles.statusFoto}>Foto enviada: aguardando aprovação da secretaria.</Text>
              )}
              {situacaoFoto?.status === 'recusada' && (
                <Text style={[styles.statusFoto, { color: cores.vinho }]}>
                  Foto não aprovada{situacaoFoto.motivo ? `: ${situacaoFoto.motivo}` : ''}. Envie outra.
                </Text>
              )}
              <Pressable onPress={pedirFoto} disabled={enviandoFoto} accessibilityRole="button">
                <Text style={styles.linkFoto}>
                  {enviandoFoto
                    ? 'Enviando foto…'
                    : foto.aprovadaUrl || situacaoFoto
                      ? 'Trocar foto'
                      : 'Adicionar foto do aluno'}
                </Text>
              </Pressable>
              <MensagemErro texto={erroFoto} />
            </View>
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
  identificacao: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  foto: {
    width: 84,
    height: 112,
    borderRadius: 10,
    backgroundColor: cores.creme,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoInicial: { fontFamily: fontes.titulo, fontSize: 36, color: cores.verdeMedio },
  fotoCarregando: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,61,36,0.55)', alignItems: 'center', justifyContent: 'center' },
  statusFoto: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.dourado },
  linkFoto: { fontFamily: fontes.corpoNegrito, fontSize: 14, color: cores.verdeClaro },
  nome: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28, color: cores.verdeEscuro },
  detalhe: { fontFamily: fontes.corpo, fontSize: 15, color: cores.textoSuave },
  areaQR: { alignItems: 'center', justifyContent: 'center' },
  nota: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.textoSuave, textAlign: 'center' },
  aviso: { fontFamily: fontes.corpo, fontSize: 12, lineHeight: 18, color: cores.textoSuave, textAlign: 'center' },
});
