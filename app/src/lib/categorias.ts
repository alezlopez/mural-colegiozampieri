import { cores } from './theme';

export type Categoria = 'comunicado' | 'aviso' | 'lembrete' | 'evento' | 'galeria';

export const CATEGORIAS: Record<Categoria, { rotulo: string; plural: string; cor: string }> = {
  comunicado: { rotulo: 'Comunicado', plural: 'Comunicados', cor: cores.verdeMedio },
  aviso: { rotulo: 'Aviso', plural: 'Avisos', cor: cores.vinho },
  lembrete: { rotulo: 'Lembrete', plural: 'Lembretes', cor: cores.dourado },
  evento: { rotulo: 'Evento', plural: 'Eventos', cor: cores.verdeClaro },
  galeria: { rotulo: 'Fotos', plural: 'Fotos', cor: cores.verdeEscuro },
};

export const ORDEM_CATEGORIAS: Categoria[] = ['comunicado', 'aviso', 'lembrete', 'evento', 'galeria'];
