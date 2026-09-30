import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registrarPushToken } from './api';
import { cores } from './theme';

export const CANAL_ANDROID = 'mural';

export type EstadoPermissao = 'indisponivel' | 'pendente' | 'concedida' | 'negada';

const pushSuportado = Platform.OS !== 'web' && Device.isDevice;

async function configurarCanalAndroid() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
    name: 'Mural da escola',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: cores.verdeClaro,
  });
}

async function lerPermissao(): Promise<EstadoPermissao> {
  if (!pushSuportado) return 'indisponivel';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'concedida';
  if (status === 'denied' && !canAskAgain) return 'negada';
  return 'pendente';
}

async function obterERegistrarToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] projectId do EAS ausente: rode `npx eas-cli init` no diretório app/');
    return;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registrarPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
}

/**
 * Estado da permissão de notificações + ação para pedir.
 * Não pedimos permissão automaticamente na primeira abertura: o app mostra
 * um convite no mural explicando o benefício e só então chama o diálogo do sistema.
 * Sempre que a permissão está concedida, o token é (re)registrado, mantendo
 * `ultimo_acesso` atualizado no servidor.
 */
export function useNotificacoes() {
  const [estado, setEstado] = useState<EstadoPermissao>(pushSuportado ? 'pendente' : 'indisponivel');

  const sincronizar = useCallback(
    () =>
      lerPermissao()
        .then(async (atual) => {
          setEstado(atual);
          if (atual === 'concedida') {
            await configurarCanalAndroid();
            await obterERegistrarToken();
          }
        })
        .catch((e) => console.warn('[push]', e)),
    [],
  );

  useEffect(() => {
    sincronizar();
    // Usuário pode ter ativado nas configurações do sistema e voltado ao app.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sincronizar();
    });
    return () => sub.remove();
  }, [sincronizar]);

  const pedirPermissao = useCallback(async () => {
    if (!pushSuportado) return;
    // No Android 13+ o canal precisa existir antes do pedido para o diálogo aparecer.
    await configurarCanalAndroid();
    await Notifications.requestPermissionsAsync();
    await sincronizar();
  }, [sincronizar]);

  return { estado, pedirPermissao };
}
