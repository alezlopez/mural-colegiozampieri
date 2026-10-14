import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MensagemErro } from '@/components/Formulario';
import { darCiencia, ocorrenciasDoAluno, TIPOS_OCORRENCIA, type OcorrenciaDaFamilia } from '@/lib/escola';
import { cores, fontes } from '@/lib/theme';

const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

export default function Ocorrencias() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [lista, setLista] = useState<OcorrenciaDaFamilia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    ocorrenciasDoAluno(codigo)
      .then((l) => {
        if (!ativo) return;
        setLista(l);
        setErro(null);
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => ativo && setAtualizando(false));
    return () => {
      ativo = false;
    };
  }, [codigo, versao]);

  const recarregar = useCallback(() => {
    setAtualizando(true);
    setVersao((v) => v + 1);
  }, []);

  async function confirmar(id: string) {
    setConfirmando(id);
    try {
      const em = await darCiencia(id);
      setLista((l) => l?.map((o) => (o.id === id ? { ...o, ciencia_em: em } : o)) ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível confirmar.');
    } finally {
      setConfirmando(null);
    }
  }

  if (!lista && !erro) return <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 48 }} />;

  return (
    <ScrollView
      contentContainerStyle={styles.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={recarregar} tintColor={cores.verdeMedio} />}
    >
      <MensagemErro texto={erro} />
      {lista?.length === 0 && <Text style={styles.vazio}>Nenhuma ocorrência registrada.</Text>}
      {lista?.map((o) => {
        const pendente = o.exige_ciencia && !o.ciencia_em;
        return (
          <View key={o.id} style={[styles.cartao, pendente && { borderColor: cores.vinho }]}>
            <Text style={styles.rotulo}>
              {TIPOS_OCORRENCIA[o.tipo] ?? o.tipo} · {dataBr(o.data)}
            </Text>
            <Text style={styles.texto}>{o.descricao}</Text>
            {o.providencia && (
              <Text style={styles.detalhe}>
                <Text style={{ fontFamily: fontes.corpoNegrito }}>Providência: </Text>
                {o.providencia}
              </Text>
            )}
            <Text style={styles.detalhe}>Registrada por {o.registrado_por_nome}</Text>
            {o.exige_ciencia &&
              (o.ciencia_em ? (
                <Text style={styles.ciente}>✓ Ciência confirmada em {dataHoraBr(o.ciencia_em)}</Text>
              ) : (
                <Pressable
                  onPress={() => void confirmar(o.id)}
                  disabled={confirmando === o.id}
                  style={({ pressed }) => [styles.botao, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.botaoTexto}>{confirmando === o.id ? 'Confirmando…' : 'Li e estou ciente'}</Text>
                </Pressable>
              ))}
          </View>
        );
      })}
      <Text style={styles.nota}>Dúvidas sobre uma ocorrência? Fale com a coordenação.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 16, gap: 12 },
  vazio: { fontFamily: fontes.corpo, fontSize: 15, color: cores.textoSuave, textAlign: 'center', marginTop: 24 },
  cartao: { backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: 16, gap: 6 },
  rotulo: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 1.5, color: cores.dourado, textTransform: 'uppercase' },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.texto },
  detalhe: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.textoSuave },
  ciente: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.verdeClaro, marginTop: 4 },
  botao: { backgroundColor: cores.verdeEscuro, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  botaoTexto: { fontFamily: fontes.corpoNegrito, fontSize: 15, color: cores.branco },
  nota: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, textAlign: 'center', marginTop: 8 },
});
