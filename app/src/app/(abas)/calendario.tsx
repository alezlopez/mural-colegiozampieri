import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MensagemErro } from '@/components/Formulario';
import { PrecisaEntrar } from '@/components/PrecisaEntrar';
import { SeletorFilho } from '@/components/SeletorFilho';
import { diaCurto, hojeISO, nomeDoMes, somarDiasISO } from '@/lib/datas';
import { eventosDaTurma, ROTULO_EVENTO, type EventoEscolar } from '@/lib/escola';
import { useFilhos } from '@/lib/filhos';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';

export default function Calendario() {
  const { usuarioId } = useSessao();
  const { selecionado } = useFilhos();
  const [anteriores, setAnteriores] = useState(false);
  const [versao, setVersao] = useState(0);
  const [carregado, setCarregado] = useState<{ chave: string; eventos: EventoEscolar[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const turma = selecionado?.turmaAtual;
  const chave = `${turma?.turma_id}|${anteriores}|${versao}`;

  useEffect(() => {
    if (!turma) return;
    let ativo = true;
    const hoje = hojeISO();
    const de = anteriores ? `${turma.ano}-01-01` : hoje;
    eventosDaTurma(turma.turma_id, de, somarDiasISO(hoje, 365))
      .then((eventos) => {
        if (!ativo) return;
        setCarregado({ chave, eventos });
        setErro(null);
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => ativo && setAtualizando(false));
    return () => {
      ativo = false;
    };
  }, [turma, anteriores, chave]);

  if (!usuarioId) {
    return <PrecisaEntrar titulo="Calendário escolar" texto="Entre como responsável para ver feriados, avaliações, reuniões e eventos da turma dos seus filhos." />;
  }

  const eventos = carregado?.chave === chave ? carregado.eventos : null;
  const porMes = new Map<string, EventoEscolar[]>();
  for (const e of eventos ?? []) {
    const mes = `${e.inicio.slice(0, 7)}-01`;
    porMes.set(mes, [...(porMes.get(mes) ?? []), e]);
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => {
            setAtualizando(true);
            setVersao((v) => v + 1);
          }}
          tintColor={cores.verdeMedio}
          colors={[cores.verdeMedio]}
        />
      }
    >
      <SeletorFilho />
      <View style={styles.conteudo}>
        {selecionado && !turma && <Text style={styles.vazio}>{selecionado.nome.split(' ')[0]} ainda não está em uma turma deste ano letivo.</Text>}
        {turma && <Text style={styles.turma}>{turma.nome}</Text>}
        <MensagemErro texto={erro} />
        {turma && !eventos && !erro && <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 24 }} />}
        {eventos && eventos.length === 0 && <Text style={styles.vazio}>Nenhum evento no calendário {anteriores ? 'deste ano' : 'daqui para frente'}.</Text>}

        {[...porMes.entries()].map(([mes, lista]) => (
          <View key={mes} style={{ gap: 8 }}>
            <Text style={styles.mes}>{nomeDoMes(mes)}</Text>
            {lista.map((e) => (
              <View key={e.id} style={styles.cartao}>
                <View style={[styles.data, !e.letivo && { backgroundColor: '#8B1A1A14' }]}>
                  <Text style={[styles.dataTexto, !e.letivo && { color: cores.vinho }]}>{diaCurto(e.inicio)}</Text>
                  {e.fim !== e.inicio && <Text style={styles.ate}>até {diaCurto(e.fim)}</Text>}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.tipo, !e.letivo && { color: cores.vinho }]}>
                    {(ROTULO_EVENTO[e.tipo] ?? 'Aviso').toUpperCase()}
                    {!e.letivo ? ' · SEM AULA' : ''}
                  </Text>
                  <Text style={styles.titulo}>{e.titulo}</Text>
                  {e.descricao && <Text style={styles.descricao}>{e.descricao}</Text>}
                </View>
              </View>
            ))}
          </View>
        ))}

        {turma && (
          <Pressable onPress={() => setAnteriores((a) => !a)} style={styles.alternar} accessibilityRole="button">
            <Text style={styles.alternarTexto}>{anteriores ? 'Mostrar só os próximos' : 'Mostrar também os que já passaram'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  turma: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, textAlign: 'center' },
  vazio: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave, textAlign: 'center', marginTop: 24 },
  mes: { fontFamily: fontes.titulo, fontSize: 20, color: cores.verdeEscuro, textTransform: 'capitalize' },
  cartao: { flexDirection: 'row', gap: 12, backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: 12 },
  data: { width: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.creme, borderRadius: 8, paddingVertical: 6 },
  dataTexto: { fontFamily: fontes.corpoNegrito, fontSize: 12, color: cores.verdeEscuro, textAlign: 'center' },
  ate: { fontFamily: fontes.corpo, fontSize: 10, color: cores.textoSuave, textAlign: 'center' },
  tipo: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1.2, color: cores.dourado },
  titulo: { fontFamily: fontes.corpoNegrito, fontSize: 15, color: cores.texto },
  descricao: { fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19, color: cores.textoSuave },
  alternar: { alignSelf: 'center', paddingVertical: 10 },
  alternarTexto: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.verdeClaro },
});
