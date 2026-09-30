import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORIAS, ORDEM_CATEGORIAS, type Categoria } from '@/lib/categorias';
import { cores, fontes } from '@/lib/theme';

type Props = {
  selecionada: Categoria | undefined;
  onChange: (c: Categoria | undefined) => void;
};

export function FiltroCategorias({ selecionada, onChange }: Props) {
  const opcoes: { valor: Categoria | undefined; rotulo: string }[] = [
    { valor: undefined, rotulo: 'Tudo' },
    ...ORDEM_CATEGORIAS.map((c) => ({ valor: c, rotulo: CATEGORIAS[c].plural })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lista}>
      {opcoes.map((o) => {
        const ativo = o.valor === selecionada;
        return (
          <Pressable
            key={o.rotulo}
            onPress={() => onChange(o.valor)}
            style={[styles.chip, ativo && styles.chipAtivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
          >
            <Text style={[styles.rotulo, ativo && styles.rotuloAtivo]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.branco,
  },
  chipAtivo: { backgroundColor: cores.verdeMedio, borderColor: cores.verdeMedio },
  rotulo: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.textoSuave },
  rotuloAtivo: { color: cores.branco },
});
