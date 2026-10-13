import { router } from 'expo-router';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Botao, MensagemErro } from '@/components/Formulario';
import { PrecisaEntrar } from '@/components/PrecisaEntrar';
import { useFilhos } from '@/lib/filhos';
import { useSessao } from '@/lib/sessao';
import { exibirTelefone } from '@/lib/telefone';
import { cores, fontes } from '@/lib/theme';

export default function Familia() {
  const { usuarioId, telefone, biometria, definirBiometria, sair } = useSessao();
  const { filhos, erro } = useFilhos();

  if (!usuarioId) {
    return <PrecisaEntrar titulo="Minha família" texto="Entre com o código do aluno ou o CPF do responsável financeiro e o celular cadastrado na secretaria." />;
  }

  function confirmarSaida() {
    const executar = async () => {
      await sair();
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      executar();
      return;
    }
    Alert.alert('Sair da conta?', 'Para entrar de novo será preciso receber um código pelo WhatsApp.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: executar },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={{ gap: 4 }}>
        <Text style={styles.sobretitulo}>ÁREA DA FAMÍLIA</Text>
        <Text style={styles.titulo}>Seus filhos</Text>
        {telefone && <Text style={styles.texto}>Conectado como {exibirTelefone(telefone)}</Text>}
      </View>

      <MensagemErro texto={erro} />
      {!filhos && !erro && <ActivityIndicator color={cores.verdeMedio} />}
      {filhos?.length === 0 && (
        <Text style={styles.texto}>Nenhum aluno ativo vinculado a este telefone. Procure a secretaria.</Text>
      )}
      {filhos?.map((a) => (
        <View key={a.codigo} style={styles.cartao}>
          <View style={styles.inicial}>
            <Text style={styles.inicialTexto}>{a.nome.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{a.nome}</Text>
            <Text style={styles.detalhe}>
              {a.turmaAtual?.nome ?? a.turma} · código {a.codigo}
            </Text>
            <View style={styles.acoes}>
              <Pressable
                onPress={() => router.push({ pathname: '/carteirinha/[codigo]', params: { codigo: a.codigo } })}
                accessibilityRole="button"
                hitSlop={6}
              >
                <Text style={styles.link}>Carteirinha ›</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/frequencia/[codigo]', params: { codigo: a.codigo } })}
                accessibilityRole="button"
                hitSlop={6}
              >
                <Text style={styles.link}>Frequência ›</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}

      <Text style={styles.nota}>
        No mural você passa a ver também os avisos das turmas dos seus filhos, e recebe as notificações delas.
      </Text>

      {biometria.disponivel && (
        <View style={styles.opcao}>
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoTitulo}>Proteger com {biometria.nome}</Text>
            <Text style={styles.detalhe}>Pede o {biometria.nome} ao abrir o app.</Text>
          </View>
          <Switch
            value={biometria.ativa}
            onValueChange={(v) => {
              definirBiometria(v);
            }}
            trackColor={{ true: cores.verdeClaro, false: cores.borda }}
            thumbColor={cores.branco}
          />
        </View>
      )}

      <Botao titulo="Sair da conta" onPress={confirmarSaida} variante="secundario" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 20, gap: 14 },
  sobretitulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 2.4, color: cores.dourado },
  titulo: { fontFamily: fontes.titulo, fontSize: 28, color: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: cores.branco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
  },
  inicial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.verdeEscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialTexto: { fontFamily: fontes.titulo, fontSize: 20, color: cores.douradoClaro },
  nome: { fontFamily: fontes.titulo, fontSize: 18, color: cores.verdeEscuro },
  link: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.verdeClaro },
  acoes: { flexDirection: 'row', gap: 18, marginTop: 6 },
  detalhe: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, marginTop: 2 },
  nota: {
    fontFamily: fontes.corpo,
    fontSize: 14,
    lineHeight: 20,
    color: cores.texto,
    backgroundColor: cores.creme,
    borderRadius: 10,
    padding: 14,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.branco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
  },
  opcaoTitulo: { fontFamily: fontes.corpoNegrito, fontSize: 15, color: cores.verdeEscuro },
});
