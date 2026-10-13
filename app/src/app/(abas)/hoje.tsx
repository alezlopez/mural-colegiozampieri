import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MensagemErro } from '@/components/Formulario';
import { PrecisaEntrar } from '@/components/PrecisaEntrar';
import { SeletorFilho } from '@/components/SeletorFilho';
import { diaCurto, diaDaSemanaISO, hojeISO, somarDiasISO } from '@/lib/datas';
import { aulasDoDia, eventosDaTurma, ROTULO_EVENTO, tarefasParaEntregar, type AulaDoDia, type EventoEscolar, type StatusChamada, type Tarefa } from '@/lib/escola';
import { useFilhos } from '@/lib/filhos';
import { useSessao } from '@/lib/sessao';
import { cores, fontes } from '@/lib/theme';

const PRESENCA: Record<StatusChamada, { rotulo: string; cor: string; fundo: string }> = {
  presente: { rotulo: 'Presente', cor: cores.verdeClaro, fundo: '#2D7A4E1F' },
  falta: { rotulo: 'Falta', cor: cores.branco, fundo: cores.vinho },
  falta_justificada: { rotulo: 'Falta justificada', cor: cores.dourado, fundo: '#B8860B26' },
};

type Dados = { chave: string; aulas: AulaDoDia[]; eventos: EventoEscolar[]; tarefas: Tarefa[] };

export default function HojeNaEscola() {
  const { usuarioId } = useSessao();
  const { filhos, selecionado, erro: erroFilhos } = useFilhos();
  const [data, setData] = useState(hojeISO());
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [versao, setVersao] = useState(0);

  const turma = selecionado?.turmaAtual;
  const chave = `${selecionado?.codigo}|${turma?.turma_id}|${data}|${versao}`;

  useEffect(() => {
    if (!selecionado || !turma) return;
    let ativo = true;
    const hoje = hojeISO();
    Promise.all([
      aulasDoDia(turma.turma_id, selecionado.codigo, data),
      eventosDaTurma(turma.turma_id, data, data),
      tarefasParaEntregar(turma.turma_id, hoje),
    ])
      .then(([aulas, eventos, tarefas]) => {
        if (!ativo) return;
        setDados({ chave, aulas, eventos, tarefas });
        setErro(null);
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => ativo && setAtualizando(false));
    return () => {
      ativo = false;
    };
  }, [selecionado, turma, data, chave]);

  const atualizar = useCallback(() => {
    setAtualizando(true);
    setVersao((v) => v + 1);
  }, []);

  if (!usuarioId) {
    return <PrecisaEntrar titulo="Hoje na escola" texto="Entre como responsável para ver o conteúdo das aulas, as tarefas e a presença dos seus filhos." />;
  }

  const atuais = dados?.chave === chave ? dados : null;
  const fimDeSemana = [0, 6].includes(diaDaSemanaISO(data));
  const ehHoje = data === hojeISO();

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.verdeMedio} colors={[cores.verdeMedio]} />}
    >
      <SeletorFilho />
      <MensagemErro texto={erroFilhos} />

      <View style={styles.navDia}>
        <Pressable onPress={() => setData((d) => somarDiasISO(d, -1))} style={styles.seta} accessibilityLabel="Dia anterior" hitSlop={8}>
          <Text style={styles.setaTexto}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setData(hojeISO())} style={{ alignItems: 'center', flex: 1 }} accessibilityLabel="Voltar para hoje">
          <Text style={styles.sobretitulo}>{ehHoje ? 'HOJE' : 'TOQUE PARA VOLTAR A HOJE'}</Text>
          <Text style={styles.dia}>{diaCurto(data)}</Text>
        </Pressable>
        <Pressable onPress={() => setData((d) => somarDiasISO(d, 1))} style={styles.seta} accessibilityLabel="Próximo dia" hitSlop={8}>
          <Text style={styles.setaTexto}>›</Text>
        </Pressable>
      </View>

      <View style={styles.conteudo}>
        {filhos && filhos.length === 0 && <Text style={styles.vazio}>Nenhum aluno vinculado a este telefone. Procure a secretaria.</Text>}
        {selecionado && !turma && (
          <Text style={styles.vazio}>{selecionado.nome.split(' ')[0]} ainda não está em uma turma deste ano letivo.</Text>
        )}
        {selecionado && turma && (
          <Text style={styles.turma}>
            {selecionado.nome.split(' ')[0]} · {turma.nome}
          </Text>
        )}

        <MensagemErro texto={erro} />
        {turma && !atuais && !erro && <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 24 }} />}

        {atuais?.eventos.map((e) => (
          <View key={e.id} style={[styles.evento, !e.letivo && styles.eventoSemAula]}>
            <Text style={[styles.eventoTexto, !e.letivo && { color: cores.vinho }]}>
              <Text style={{ fontFamily: fontes.corpoNegrito }}>{ROTULO_EVENTO[e.tipo] ?? 'Aviso'}:</Text> {e.titulo}
              {!e.letivo ? ' — sem aula' : ''}
            </Text>
          </View>
        ))}

        {atuais && atuais.aulas.length === 0 && (
          <Text style={styles.vazio}>
            {fimDeSemana && atuais.eventos.length === 0 ? 'Fim de semana.' : 'Nenhuma aula lançada pelos professores para este dia.'}
          </Text>
        )}

        {atuais?.aulas.map((a) => {
          const p = a.presenca ? PRESENCA[a.presenca] : null;
          return (
            <View key={a.id} style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <Text style={styles.numero}>{a.aula_numero}ª aula</Text>
                {p && (
                  <Text style={[styles.presenca, { color: p.cor, backgroundColor: p.fundo }]} accessibilityLabel={`Chamada: ${p.rotulo}`}>
                    {p.rotulo}
                  </Text>
                )}
              </View>
              <Text style={styles.disciplina}>{a.disciplina}</Text>
              <Text style={styles.texto}>{a.conteudo}</Text>
              {a.tarefa && (
                <View style={styles.tarefa}>
                  <Text style={styles.tarefaRotulo}>TAREFA{a.tarefa_entrega ? ` · PARA ${diaCurto(a.tarefa_entrega).toUpperCase()}` : ''}</Text>
                  <Text style={styles.texto}>{a.tarefa}</Text>
                </View>
              )}
            </View>
          );
        })}

        {atuais && atuais.tarefas.length > 0 && (
          <View style={{ marginTop: 18, gap: 8 }}>
            <Text style={styles.secao}>TAREFAS PARA ENTREGAR</Text>
            {atuais.tarefas.map((t) => (
              <View key={t.id} style={styles.linhaTarefa}>
                <View style={styles.entrega}>
                  <Text style={styles.entregaTexto}>{diaCurto(t.entrega)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disciplinaPequena}>{t.disciplina}</Text>
                  <Text style={styles.texto}>{t.tarefa}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  navDia: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  seta: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.branco, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { fontSize: 24, color: cores.verdeEscuro, marginTop: -3 },
  sobretitulo: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1.6, color: cores.dourado },
  dia: { fontFamily: fontes.titulo, fontSize: 22, color: cores.verdeEscuro },
  conteudo: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  turma: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave, textAlign: 'center' },
  vazio: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.textoSuave, textAlign: 'center', marginTop: 24 },
  evento: { borderRadius: 10, borderWidth: 1, borderColor: '#B8860B66', backgroundColor: '#B8860B14', padding: 12 },
  eventoSemAula: { borderColor: '#8B1A1A4D', backgroundColor: '#8B1A1A0D' },
  eventoTexto: { fontFamily: fontes.corpo, fontSize: 14, color: cores.texto },
  cartao: { backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: 14, gap: 4 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numero: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 1, color: cores.textoSuave },
  presenca: { fontFamily: fontes.corpoNegrito, fontSize: 12, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  disciplina: { fontFamily: fontes.titulo, fontSize: 18, color: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21, color: cores.texto },
  tarefa: { marginTop: 6, backgroundColor: cores.creme, borderRadius: 8, padding: 10, gap: 2 },
  tarefaRotulo: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1.2, color: cores.dourado },
  secao: { fontFamily: fontes.corpoNegrito, fontSize: 11, letterSpacing: 2.4, color: cores.dourado },
  linhaTarefa: { flexDirection: 'row', gap: 12, backgroundColor: cores.branco, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: 12 },
  entrega: { width: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.creme, borderRadius: 8, paddingVertical: 6 },
  entregaTexto: { fontFamily: fontes.corpoNegrito, fontSize: 12, color: cores.verdeEscuro, textAlign: 'center' },
  disciplinaPequena: { fontFamily: fontes.corpoNegrito, fontSize: 13, color: cores.verdeEscuro },
});
