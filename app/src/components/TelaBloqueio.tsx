import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';
import { Botao } from './Formulario';
import { Tricolor } from './Tricolor';

/** Cobre o app enquanto a biometria não for confirmada. */
export function TelaBloqueio() {
  const { biometria, desbloquear, sair } = useSessao();
  const insets = useSafeAreaInsets();
  const [tentando, setTentando] = useState(false);

  async function tentar() {
    setTentando(true);
    await desbloquear();
    setTentando(false);
  }

  // Pede a biometria assim que a tela aparece.
  useEffect(() => {
    desbloquear();
  }, [desbloquear]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.tela, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.centro}>
        <View style={styles.selo}>
          <Image source={require('../../assets/brasao.png')} style={styles.brasao} contentFit="contain" />
        </View>
        <Text style={styles.nome}>Colégio Zampieri</Text>
        <Text style={styles.texto}>App protegido com {biometria.nome}</Text>
      </View>
      <View style={styles.acoes}>
        <Botao titulo={`Desbloquear com ${biometria.nome}`} onPress={tentar} carregando={tentando} />
        <Botao titulo="Sair e entrar com código" onPress={sair} variante="texto" />
      </View>
      <View style={styles.faixa}>
        <Tricolor />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { backgroundColor: cores.verdeEscuro, justifyContent: 'space-between', padding: 24, zIndex: 100 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  selo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brasao: { width: 66, height: 82 },
  nome: { fontFamily: fontes.titulo, fontSize: 28, color: cores.branco },
  texto: { fontFamily: fontes.corpo, fontSize: 15, color: cores.creme },
  acoes: { gap: 8 },
  faixa: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
