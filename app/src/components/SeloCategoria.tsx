import { StyleSheet, Text, View } from 'react-native';
import { CATEGORIAS, type Categoria } from '@/lib/categorias';
import { cores, fontes } from '@/lib/theme';

export function SeloCategoria({ categoria }: { categoria: Categoria }) {
  const c = CATEGORIAS[categoria];
  return (
    <View style={[styles.selo, { backgroundColor: c.cor }]}>
      <Text style={styles.texto}>{c.rotulo.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selo: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  texto: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1.2, color: cores.branco },
});
