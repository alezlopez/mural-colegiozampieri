import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, AppState, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Cabecalho } from '@/components/Cabecalho';
import { ConviteNotificacoes } from '@/components/ConviteNotificacoes';
import { FiltroCategorias } from '@/components/FiltroCategorias';
import { PostCard } from '@/components/PostCard';
import { listarPosts, TAMANHO_PAGINA, type Post } from '@/lib/api';
import { CATEGORIAS, type Categoria } from '@/lib/categorias';
import { useNotificacoes } from '@/lib/push';
import { cores, fontes } from '@/lib/theme';

export default function Mural() {
  const [categoria, setCategoria] = useState<Categoria | undefined>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { estado, pedirPermissao } = useNotificacoes();

  // Evita que uma resposta antiga (de outro filtro) sobrescreva a atual.
  const requisicao = useRef(0);

  const carregar = useCallback(
    (novaPagina: number) => {
      const id = ++requisicao.current;
      return listarPosts({ categoria, pagina: novaPagina })
        .then(
          (lote) => {
            if (id !== requisicao.current) return;
            setPosts((atuais) =>
              novaPagina === 0 ? lote : [...atuais, ...lote.filter((p) => !atuais.some((a) => a.id === p.id))],
            );
            setPagina(novaPagina);
            setTemMais(lote.length === TAMANHO_PAGINA);
            setErro(null);
          },
          (e: unknown) => {
            if (id !== requisicao.current) return;
            setErro(e instanceof Error ? e.message : 'Não foi possível carregar o mural.');
          },
        )
        .finally(() => {
          if (id === requisicao.current) {
            setCarregando(false);
            setAtualizando(false);
          }
        });
    },
    [categoria],
  );

  useEffect(() => {
    carregar(0);
  }, [carregar]);

  const mudarCategoria = (c: Categoria | undefined) => {
    if (c === categoria) return;
    setPosts([]);
    setCarregando(true);
    setCategoria(c);
  };

  // Recarrega ao voltar para o app e quando chega uma notificação com o app aberto.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') carregar(0);
    });
    const subNotif = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(() => carregar(0));
    return () => {
      sub.remove();
      subNotif?.remove();
    };
  }, [carregar]);

  const atualizar = () => {
    setAtualizando(true);
    carregar(0);
  };

  const carregarMais = () => {
    if (!carregando && !atualizando && temMais && !erro) carregar(pagina + 1);
  };

  return (
    <View style={styles.tela}>
      <Cabecalho />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={
          <>
            <FiltroCategorias selecionada={categoria} onChange={mudarCategoria} />
            <ConviteNotificacoes estado={estado} onAtivar={pedirPermissao} />
          </>
        }
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color={cores.verdeMedio} style={{ marginTop: 48 }} />
          ) : (
            <View style={styles.vazio}>
              <Text style={styles.vazioTitulo}>{erro ? 'Sem conexão com o mural' : 'Nada por aqui ainda'}</Text>
              <Text style={styles.vazioTexto}>
                {erro
                  ? 'Verifique sua internet e puxe para baixo para tentar de novo.'
                  : categoria
                    ? `Ainda não há ${CATEGORIAS[categoria].plural.toLowerCase()} publicados.`
                    : 'As publicações da escola aparecerão aqui.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          posts.length > 0 && temMais ? <ActivityIndicator color={cores.verdeMedio} style={{ marginVertical: 24 }} /> : null
        }
        onEndReached={carregarMais}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.verdeMedio} colors={[cores.verdeMedio]} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.brancoQuente },
  vazio: { alignItems: 'center', paddingHorizontal: 32, marginTop: 48, gap: 8 },
  vazioTitulo: { fontFamily: fontes.titulo, fontSize: 20, color: cores.verdeEscuro, textAlign: 'center' },
  vazioTexto: { fontFamily: fontes.corpo, fontSize: 15, color: cores.textoSuave, textAlign: 'center', lineHeight: 22 },
});
