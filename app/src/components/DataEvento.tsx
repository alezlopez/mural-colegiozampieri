import { StyleSheet, Text, View } from 'react-native';
import { dataEvento } from '@/lib/datas';
import { cores, fontes } from '@/lib/theme';

export function DataEvento({ iso, compacto = false }: { iso: string; compacto?: boolean }) {
  const d = dataEvento(iso);
  return (
    <View style={styles.linha}>
      <View style={styles.calendario}>
        <Text style={styles.mes}>{d.mes}</Text>
        <Text style={styles.dia}>{d.dia}</Text>
      </View>
      <Text style={[styles.descricao, compacto && { fontSize: 13 }]} numberOfLines={2}>
        {d.descricao}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendario: {
    width: 44,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: cores.dourado,
    alignItems: 'center',
    backgroundColor: cores.branco,
  },
  mes: {
    alignSelf: 'stretch',
    textAlign: 'center',
    backgroundColor: cores.dourado,
    color: cores.branco,
    fontFamily: fontes.corpoNegrito,
    fontSize: 10,
    letterSpacing: 1,
    paddingVertical: 2,
  },
  dia: { fontFamily: fontes.titulo, fontSize: 18, color: cores.verdeEscuro, paddingVertical: 2 },
  descricao: { flex: 1, fontFamily: fontes.corpoNegrito, fontSize: 14, color: cores.texto },
});
