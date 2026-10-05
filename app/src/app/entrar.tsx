import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Botao, Campo, MensagemErro } from '@/components/Formulario';
import { enviarCodigo, solicitarAcesso } from '@/lib/api';
import { mascararTelefone } from '@/lib/telefone';
import { cores, fontes } from '@/lib/theme';

export default function Entrar() {
  const [codigoAluno, setCodigoAluno] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoTelefone = useRef<TextInput>(null);

  const digitos = telefone.replace(/\D/g, '');
  const valido = codigoAluno.trim().length > 0 && (digitos.length === 10 || digitos.length === 11);

  async function continuar() {
    if (!valido || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const telefoneE164 = await solicitarAcesso(codigoAluno.trim(), telefone);
      await enviarCodigo(telefoneE164);
      router.push({ pathname: '/verificar', params: { telefone: telefoneE164 } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível continuar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={styles.sobretitulo}>ÁREA DA FAMÍLIA</Text>
          <Text style={styles.titulo}>Entrar como responsável</Text>
          <Text style={styles.texto}>
            Use o código do aluno e o celular cadastrado na secretaria. Enviaremos um código de confirmação pelo WhatsApp.
          </Text>
        </View>

        <Campo
          rotulo="Código do aluno"
          value={codigoAluno}
          onChangeText={setCodigoAluno}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => campoTelefone.current?.focus()}
          placeholder="Ex.: 2024017"
          ajuda="Está na carteirinha e nos boletos da escola."
        />
        <Campo
          ref={campoTelefone}
          rotulo="Celular do responsável"
          value={telefone}
          onChangeText={(t) => setTelefone(mascararTelefone(t))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="send"
          onSubmitEditing={continuar}
          placeholder="(11) 99999-8888"
        />

        <MensagemErro texto={erro} />
        <Botao titulo="Receber código no WhatsApp" onPress={continuar} carregando={enviando} desativado={!valido} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 24, gap: 20 },
  sobretitulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 2.4, color: cores.dourado },
  titulo: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 34, color: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave },
});
