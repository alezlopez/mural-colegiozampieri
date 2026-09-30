import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EstadoPermissao } from '@/lib/push';
import { cores, fontes } from '@/lib/theme';

type Props = { estado: EstadoPermissao; onAtivar: () => void };

export function ConviteNotificacoes({ estado, onAtivar }: Props) {
  const [dispensado, setDispensado] = useState(false);
  if (dispensado || estado === 'concedida' || estado === 'indisponivel') return null;

  const negada = estado === 'negada';

  return (
    <View style={styles.caixa}>
      <Text style={styles.titulo}>Não perca nenhum aviso</Text>
      <Text style={styles.texto}>
        {negada
          ? 'As notificações estão desativadas. Ative nas configurações do celular para receber comunicados e lembretes da escola.'
          : 'Ative as notificações para receber comunicados, lembretes e avisos da escola assim que forem publicados.'}
      </Text>
      <View style={styles.acoes}>
        <Pressable
          style={styles.botao}
          onPress={negada ? () => Linking.openSettings() : onAtivar}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>{negada ? 'ABRIR CONFIGURAÇÕES' : 'ATIVAR NOTIFICAÇÕES'}</Text>
        </Pressable>
        <Pressable onPress={() => setDispensado(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.agoraNao}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: cores.verdeEscuro,
    borderLeftWidth: 4,
    borderLeftColor: cores.douradoClaro,
    gap: 8,
  },
  titulo: { fontFamily: fontes.titulo, fontSize: 18, color: cores.branco },
  texto: { fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20, color: cores.creme },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  botao: { backgroundColor: cores.dourado, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 },
  botaoTexto: { fontFamily: fontes.corpoNegrito, fontSize: 12, letterSpacing: 1.2, color: cores.verdeEscuro },
  agoraNao: { fontFamily: fontes.corpo, fontSize: 14, color: cores.creme, textDecorationLine: 'underline' },
});
