import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useFilhos } from '@/lib/filhos';
import { cores, fontes } from '@/lib/theme';

/** Escolha do filho (só aparece para quem tem mais de um). */
export function SeletorFilho() {
  const { filhos, selecionado, selecionar } = useFilhos();
  if (!filhos || filhos.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lista}>
      {filhos.map((f) => {
        const ativo = f.codigo === selecionado?.codigo;
        return (
          <Pressable
            key={f.codigo}
            onPress={() => selecionar(f.codigo)}
            style={[styles.chip, ativo && styles.chipAtivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
          >
            <Text style={[styles.texto, ativo && styles.textoAtivo]}>{f.nome.split(' ')[0]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.branco, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipAtivo: { backgroundColor: cores.verdeEscuro, borderColor: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.texto },
  textoAtivo: { color: cores.branco },
});
