import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { urlImagem, type Post } from '@/lib/api';
import { tempoRelativo } from '@/lib/datas';
import { cores, fontes } from '@/lib/theme';
import { DataEvento } from './DataEvento';
import { SeloCategoria } from './SeloCategoria';

export function PostCard({ post }: { post: Post }) {
  const capa = post.post_imagens[0];
  const extras = post.post_imagens.length - 1;
  const proporcao = capa?.largura && capa?.altura ? Math.max(capa.largura / capa.altura, 4 / 5) : 4 / 3;

  return (
    <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
      <Pressable style={styles.card} android_ripple={{ color: cores.creme }}>
        {post.fixado && (
          <View style={styles.fixado}>
            <Text style={styles.fixadoTexto}>✦ FIXADO</Text>
          </View>
        )}

        <View style={styles.corpo}>
          <View style={styles.topo}>
            <View style={styles.selos}>
              <SeloCategoria categoria={post.categoria} />
              {post.turmas && (
                <Text style={styles.turma}>
                  {post.turmas.length === 1 ? `Turma ${post.turmas[0]}` : 'Suas turmas'}
                </Text>
              )}
            </View>
            <Text style={styles.quando}>{tempoRelativo(post.publicado_em)}</Text>
          </View>

          <Text style={styles.titulo}>{post.titulo}</Text>

          {post.data_evento && <DataEvento iso={post.data_evento} compacto />}

          {post.corpo.length > 0 && (
            <Text style={styles.texto} numberOfLines={capa ? 3 : 5}>
              {post.corpo}
            </Text>
          )}
        </View>

        {capa && (
          <View>
            <Image
              source={{ uri: urlImagem(capa.storage_path) }}
              style={[styles.imagem, { aspectRatio: proporcao }]}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`Foto de ${post.titulo}`}
            />
            {extras > 0 && (
              <View style={styles.maisFotos}>
                <Text style={styles.maisFotosTexto}>+{extras} {extras === 1 ? 'foto' : 'fotos'}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cores.branco,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: cores.borda,
  },
  fixado: { backgroundColor: cores.dourado, paddingHorizontal: 16, paddingVertical: 4 },
  fixadoTexto: { fontFamily: fontes.corpoNegrito, fontSize: 10, letterSpacing: 1.4, color: cores.branco },
  corpo: { padding: 16, gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selos: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  turma: {
    fontFamily: fontes.corpoNegrito,
    fontSize: 11,
    color: cores.verdeMedio,
    borderWidth: 1,
    borderColor: cores.verdeClaro,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quando: { fontFamily: fontes.corpo, fontSize: 12, color: cores.textoSuave },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 26, color: cores.verdeEscuro },
  texto: { fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, color: cores.texto },
  imagem: { width: '100%', backgroundColor: cores.creme },
  maisFotos: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(15,61,36,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  maisFotosTexto: { fontFamily: fontes.corpoNegrito, fontSize: 12, color: cores.branco },
});
