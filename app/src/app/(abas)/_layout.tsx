import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { FilhosProvider } from '@/lib/filhos';
import { cores, fontes } from '@/lib/theme';

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];
const icone = (nome: NomeIcone, nomeAtivo: NomeIcone) =>
  function Icone({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? nomeAtivo : nome} color={color as string} size={size} />;
  };

// Abas fixas do app: Mural (público) e, para o responsável logado, a vida escolar dos filhos.
export default function LayoutAbas() {
  return (
    <FilhosProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: cores.verdeEscuro },
          headerTintColor: cores.branco,
          headerTitleStyle: { fontFamily: fontes.titulo },
          tabBarActiveTintColor: cores.verdeEscuro,
          tabBarInactiveTintColor: cores.textoSuave,
          tabBarLabelStyle: { fontFamily: fontes.corpoNegrito, fontSize: 11 },
          tabBarStyle: { backgroundColor: cores.branco, borderTopColor: cores.borda },
          sceneStyle: { backgroundColor: cores.brancoQuente },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Mural', headerShown: false, tabBarIcon: icone('newspaper-outline', 'newspaper') }} />
        <Tabs.Screen name="hoje" options={{ title: 'Hoje na escola', tabBarLabel: 'Hoje', tabBarIcon: icone('today-outline', 'today') }} />
        <Tabs.Screen name="calendario" options={{ title: 'Calendário', tabBarIcon: icone('calendar-outline', 'calendar') }} />
        <Tabs.Screen name="familia" options={{ title: 'Minha família', tabBarLabel: 'Família', tabBarIcon: icone('people-outline', 'people') }} />
      </Tabs>
    </FilhosProvider>
  );
}
