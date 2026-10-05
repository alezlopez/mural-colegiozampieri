import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';
import { Tricolor } from './Tricolor';

export function Cabecalho() {
  const insets = useSafeAreaInsets();
  const { usuarioId } = useSessao();
  return (
    <View style={{ backgroundColor: cores.verdeEscuro }}>
      <View style={[styles.conteudo, { paddingTop: insets.top + 12 }]}>
        <View style={styles.selo}>
          <Image source={require('../../assets/brasao.png')} style={styles.brasao} contentFit="contain" />
        </View>
        <View style={styles.textos}>
          <Text style={styles.nome}>Colégio Zampieri</Text>
          <Text style={styles.slogan} numberOfLines={1}>
            TRADIÇÃO EM EDUCAÇÃO
          </Text>
        </View>
        <Link href={usuarioId ? '/familia' : '/entrar'} asChild>
          <Pressable style={styles.acesso} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.acessoTexto}>{usuarioId ? 'Família' : 'Entrar'}</Text>
          </Pressable>
        </Link>
      </View>
      <Tricolor />
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  selo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tamanho mínimo digital do brasão pelo manual: 48px de altura.
  brasao: { width: 38, height: 48 },
  textos: { flex: 1 },
  nome: { fontFamily: fontes.titulo, fontSize: 22, color: cores.branco },
  acesso: {
    borderWidth: 1,
    borderColor: cores.douradoClaro,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acessoTexto: { fontFamily: fontes.corpoNegrito, fontSize: 12, letterSpacing: 0.6, color: cores.douradoClaro },
  slogan: {
    fontFamily: fontes.corpoNegrito,
    fontSize: 10,
    letterSpacing: 1.6,
    color: cores.douradoClaro,
    marginTop: 2,
  },
});
