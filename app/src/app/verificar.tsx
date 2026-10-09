import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Botao, Campo, MensagemErro } from '@/components/Formulario';
import { confirmarCodigo, enviarCodigo } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { exibirTelefone } from '@/lib/telefone';
import { cores, fontes } from '@/lib/theme';

const ESPERA_REENVIO = 60;

export default function Verificar() {
  const { telefone } = useLocalSearchParams<{ telefone: string }>();
  const { biometria } = useSessao();
  const [codigo, setCodigo] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [espera, setEspera] = useState(ESPERA_REENVIO);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function confirmar(valor = codigo) {
    if (valor.length !== 6 || conferindo) return;
    setConferindo(true);
    setErro(null);
    try {
      await confirmarCodigo(telefone, valor);
      // Fecha o fluxo de login: oferta de biometria (se houver) e depois o mural, já com os filhos no topo.
      if (biometria.disponivel) router.replace('/biometria');
      else router.dismissTo('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível confirmar.');
      setCodigo('');
    } finally {
      setConferindo(false);
    }
  }

  async function reenviar() {
    setErro(null);
    setAviso(null);
    try {
      await enviarCodigo(telefone);
      setEspera(ESPERA_REENVIO);
      setAviso('Enviamos um novo código.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reenviar.');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={styles.titulo}>Digite o código</Text>
          <Text style={styles.texto}>
            Enviamos um código de 6 dígitos pelo WhatsApp para{' '}
            <Text style={{ fontFamily: fontes.corpoNegrito, color: cores.texto }}>{exibirTelefone(telefone ?? '')}</Text>.
          </Text>
        </View>

        <Campo
          rotulo="Código de confirmação"
          value={codigo}
          onChangeText={(t) => {
            const so = t.replace(/\D/g, '').slice(0, 6);
            setCodigo(so);
            if (so.length === 6) confirmar(so);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          placeholder="000000"
          style={styles.codigo}
        />

        <MensagemErro texto={erro} />
        {aviso && <Text style={styles.aviso}>{aviso}</Text>}
        <Botao titulo="Confirmar" onPress={() => confirmar()} carregando={conferindo} desativado={codigo.length !== 6} />
        <Botao
          titulo={espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar código'}
          onPress={reenviar}
          desativado={espera > 0}
          variante="texto"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 24, gap: 20 },
  titulo: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 34, color: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave },
  codigo: { fontFamily: fontes.corpoNegrito, fontSize: 28, letterSpacing: 10, textAlign: 'center' },
  aviso: { fontFamily: fontes.corpo, fontSize: 14, color: cores.verdeMedio, textAlign: 'center' },
});
