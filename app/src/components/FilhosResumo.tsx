import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFilhos } from '@/lib/filhos';
import { cores, fontes } from '@/lib/theme';

/** Topo do mural para quem entrou: os filhos, com atalho para a carteirinha. */
export function FilhosResumo() {
  const { filhos } = useFilhos();
  if (!filhos || filhos.length === 0) return null;

  return (
    <View style={styles.bloco}>
      <Text style={styles.sobretitulo}>SUA FAMÍLIA</Text>
      {filhos.map((a) => (
        <Pressable
          key={a.codigo}
          style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({ pathname: '/carteirinha/[codigo]', params: { codigo: a.codigo } })}
          accessibilityRole="button"
          accessibilityHint="Abre a carteirinha digital do aluno"
        >
          <View style={styles.inicial}>
            <Text style={styles.inicialTexto}>{a.nome.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome} numberOfLines={1}>
              {a.nome}
            </Text>
            <Text style={styles.turma} numberOfLines={1}>
              {a.turmaAtual?.nome ?? a.turma}
            </Text>
          </View>
          <Text style={styles.acao}>Carteirinha ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  sobretitulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 2.4, color: cores.dourado },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.branco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inicial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.verdeEscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialTexto: { fontFamily: fontes.titulo, fontSize: 17, color: cores.douradoClaro },
  nome: { fontFamily: fontes.titulo, fontSize: 16, color: cores.verdeEscuro },
  turma: { fontFamily: fontes.corpo, fontSize: 12, color: cores.textoSuave, marginTop: 2 },
  acao: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.verdeClaro },
});
