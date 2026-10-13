import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/components/Formulario';
import { cores, fontes } from '@/lib/theme';

/** Tela das abas da família para quem ainda não entrou. */
export function PrecisaEntrar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.texto}>{texto}</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Botao titulo="Entrar como responsável" onPress={() => router.push('/entrar')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  titulo: { fontFamily: fontes.titulo, fontSize: 24, color: cores.verdeEscuro, textAlign: 'center' },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave, textAlign: 'center' },
});
