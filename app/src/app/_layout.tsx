import { useEffect } from 'react';
import { Lato_300Light, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { cores, fontes } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== 'web') {
  // Com o app aberto, a notificação ainda aparece como banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Toque na notificação abre a publicação correspondente (data.url = "/post/<id>"). */
function useAbrirPostDaNotificacao() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    function abrir(notificacao: Notifications.Notification) {
      const url = notificacao.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/post/')) {
        router.push(url as `/post/${string}`);
      }
    }

    const inicial = Notifications.getLastNotificationResponse();
    if (inicial?.notification) abrir(inicial.notification);

    const sub = Notifications.addNotificationResponseReceivedListener((r) => abrir(r.notification));
    return () => sub.remove();
  }, []);
}

export default function Layout() {
  const [fontesCarregadas, erroFontes] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
  });

  useAbrirPostDaNotificacao();

  useEffect(() => {
    if (fontesCarregadas || erroFontes) SplashScreen.hideAsync();
  }, [fontesCarregadas, erroFontes]);

  if (!fontesCarregadas && !erroFontes) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.verdeEscuro },
          headerTintColor: cores.branco,
          headerTitleStyle: { fontFamily: fontes.titulo },
          contentStyle: { backgroundColor: cores.brancoQuente },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Mural' }} />
        <Stack.Screen name="post/[id]" options={{ title: '', headerBackTitle: 'Mural' }} />
      </Stack>
    </>
  );
}
