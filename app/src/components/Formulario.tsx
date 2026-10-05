import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cores, fontes } from '@/lib/theme';

type BotaoProps = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desativado?: boolean;
  variante?: 'primario' | 'secundario' | 'texto';
};

export function Botao({ titulo, onPress, carregando, desativado, variante = 'primario' }: BotaoProps) {
  const inativo = desativado || carregando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      style={[styles.botao, styles[variante], inativo && { opacity: 0.55 }]}
    >
      {carregando ? (
        <ActivityIndicator color={variante === 'primario' ? cores.branco : cores.verdeMedio} />
      ) : (
        <Text style={[styles.botaoTexto, variante !== 'primario' && { color: cores.verdeMedio }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

type CampoProps = TextInputProps & { rotulo: string; ajuda?: string };

export const Campo = forwardRef<TextInput, CampoProps>(function Campo({ rotulo, ajuda, style, ...props }, ref) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.rotulo}>{rotulo.toUpperCase()}</Text>
      <TextInput ref={ref} placeholderTextColor="#9AA39D" style={[styles.campo, style]} {...props} />
      {ajuda && <Text style={styles.ajuda}>{ajuda}</Text>}
    </View>
  );
});

export function MensagemErro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <View style={styles.erro} accessibilityRole="alert">
      <Text style={styles.erroTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  botao: { borderRadius: 8, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  primario: { backgroundColor: cores.verdeMedio },
  secundario: { backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.borda },
  texto: { backgroundColor: 'transparent' },
  botaoTexto: { fontFamily: fontes.corpoNegrito, fontSize: 14, letterSpacing: 1.2, color: cores.branco, textTransform: 'uppercase' },
  rotulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 1.8, color: cores.textoSuave },
  campo: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    backgroundColor: cores.branco,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: fontes.corpo,
    fontSize: 18,
    color: cores.texto,
  },
  ajuda: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, lineHeight: 18 },
  erro: { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139,26,26,0.3)', backgroundColor: 'rgba(139,26,26,0.06)', padding: 12 },
  erroTexto: { fontFamily: fontes.corpo, fontSize: 14, color: cores.vinho, lineHeight: 20 },
});
