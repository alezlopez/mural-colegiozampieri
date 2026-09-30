import { StyleSheet, View } from 'react-native';
import { cores } from '@/lib/theme';

// Faixa decorativa verde · branco · vermelho (elemento de identidade).
export function Tricolor({ altura = 4 }: { altura?: number }) {
  return (
    <View style={[styles.faixa, { height: altura }]}>
      <View style={[styles.parte, { backgroundColor: cores.verdeClaro }]} />
      <View style={[styles.parte, { backgroundColor: cores.brancoQuente }]} />
      <View style={[styles.parte, { backgroundColor: cores.vinho }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: { flexDirection: 'row', width: '100%' },
  parte: { flex: 1 },
});
