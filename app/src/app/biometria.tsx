import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Botao, MensagemErro } from '@/components/Formulario';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';

export default function OfertaBiometria() {
  const { biometria, definirBiometria } = useSessao();
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function ativar() {
    setAtivando(true);
    setErro(null);
    const ok = await definirBiometria(true);
    setAtivando(false);
    if (ok) router.dismissTo('/');
    else setErro(`Não foi possível confirmar o ${biometria.nome}. Tente de novo ou ative depois na área da família.`);
  }

  return (
    <View style={styles.tela}>
      <View style={styles.icone}>
        <Text style={styles.iconeTexto}>✦</Text>
      </View>
      <Text style={styles.titulo}>Proteger com {biometria.nome}?</Text>
      <Text style={styles.texto}>
        Você não vai precisar receber código de novo neste celular. Ao abrir o app, pediremos o {biometria.nome} para mostrar
        os dados dos seus filhos.
      </Text>
      <MensagemErro texto={erro} />
      <View style={{ gap: 8, alignSelf: 'stretch' }}>
        <Botao titulo={`Ativar ${biometria.nome}`} onPress={ativar} carregando={ativando} />
        <Botao titulo="Agora não" onPress={() => router.dismissTo('/')} variante="texto" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
  icone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: cores.verdeEscuro,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: cores.douradoClaro,
  },
  iconeTexto: { color: cores.douradoClaro, fontSize: 28 },
  titulo: { fontFamily: fontes.titulo, fontSize: 26, color: cores.verdeEscuro, textAlign: 'center' },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave, textAlign: 'center' },
});
