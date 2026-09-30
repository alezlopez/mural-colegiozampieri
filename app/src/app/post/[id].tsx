import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { DataEvento } from '@/components/DataEvento';
import { SeloCategoria } from '@/components/SeloCategoria';
import { Tricolor } from '@/components/Tricolor';
import { buscarPost, urlImagem, type Post } from '@/lib/api';
import { CATEGORIAS } from '@/lib/categorias';
import { tempoRelativo } from '@/lib/datas';
import { cores, fontes } from '@/lib/theme';

export default function DetalhePost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao-encontrado' | 'erro'>('carregando');

  useEffect(() => {
    let ativo = true;
    buscarPost(id)
      .then((p) => {
        if (!ativo) return;
        setPost(p);
        setEstado(p ? 'ok' : 'nao-encontrado');
      })
      .catch(() => ativo && setEstado('erro'));
    return () => {
      ativo = false;
    };
  }, [id]);

  const compartilhar = () => {
    if (!post) return;
    Share.share({ message: `${post.titulo}\n\n${post.corpo}\n\n— Colégio Zampieri` });
  };

  if (estado !== 'ok' || !post) {
    return (
      <View style={styles.centro}>
        {estado === 'carregando' ? (
          <ActivityIndicator color={cores.verdeMedio} />
        ) : (
          <Text style={styles.aviso}>
            {estado === 'erro' ? 'Não foi possível carregar. Verifique sua internet.' : 'Esta publicação não está mais disponível.'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: CATEGORIAS[post.categoria].rotulo,
          headerRight: () => (
            <Pressable onPress={compartilhar} hitSlop={10} accessibilityRole="button">
              <Text style={styles.compartilhar}>Compartilhar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Tricolor />
        <View style={styles.conteudo}>
          <View style={styles.topo}>
            <SeloCategoria categoria={post.categoria} />
            <Text style={styles.quando}>{tempoRelativo(post.publicado_em)}</Text>
          </View>
          <Text style={styles.titulo} selectable>
            {post.titulo}
          </Text>
          <View style={styles.ornamento}>
            <View style={styles.linhaOrnamento} />
            <Text style={styles.estrela}>✦</Text>
            <View style={styles.linhaOrnamento} />
          </View>
          {post.data_evento && (
            <View style={styles.caixaEvento}>
              <DataEvento iso={post.data_evento} />
            </View>
          )}
          {post.corpo.length > 0 && (
            <Text style={styles.texto} selectable>
              {post.corpo}
            </Text>
          )}
        </View>

        <View style={styles.galeria}>
          {post.post_imagens.map((img, i) => (
            <Image
              key={img.storage_path}
              source={{ uri: urlImagem(img.storage_path) }}
              style={[
                styles.imagem,
                { aspectRatio: img.largura && img.altura ? img.largura / img.altura : 4 / 3 },
              ]}
              contentFit="contain"
              transition={200}
              accessibilityLabel={`Foto ${i + 1} de ${post.post_imagens.length}`}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  aviso: { fontFamily: fontes.corpo, fontSize: 16, color: cores.textoSuave, textAlign: 'center' },
  compartilhar: { fontFamily: fontes.corpoNegrito, fontSize: 14, color: cores.douradoClaro, paddingHorizontal: 4 },
  conteudo: { padding: 20, gap: 14 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quando: { fontFamily: fontes.corpo, fontSize: 13, color: cores.textoSuave },
  titulo: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 36, color: cores.verdeEscuro },
  ornamento: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  linhaOrnamento: { flex: 1, height: 1, backgroundColor: cores.dourado },
  estrela: { color: cores.dourado, fontSize: 12 },
  caixaEvento: { backgroundColor: cores.creme, borderRadius: 10, padding: 12 },
  texto: { fontFamily: fontes.corpo, fontSize: 17, lineHeight: 27, color: cores.texto },
  galeria: { gap: 6 },
  imagem: { width: '100%', backgroundColor: cores.creme },
});
