import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// A sessão (com refresh token) fica no Keychain (iOS) / Keystore (Android), nunca em texto puro.
// Alguns iOS recusam valores acima de ~2 KB no Keychain, então o valor é dividido em pedaços.
const TAMANHO_PEDACO = 1800;

const armazenamentoSeguro: SupportedStorage = {
  async getItem(chave) {
    const total = await SecureStore.getItemAsync(`${chave}.n`);
    if (!total) return null;
    const partes: string[] = [];
    for (let i = 0; i < Number(total); i++) {
      const parte = await SecureStore.getItemAsync(`${chave}.${i}`);
      if (parte === null) return null;
      partes.push(parte);
    }
    return partes.join('');
  },
  async setItem(chave, valor) {
    const anterior = Number((await SecureStore.getItemAsync(`${chave}.n`)) ?? 0);
    const total = Math.ceil(valor.length / TAMANHO_PEDACO);
    for (let i = 0; i < total; i++) {
      await SecureStore.setItemAsync(`${chave}.${i}`, valor.slice(i * TAMANHO_PEDACO, (i + 1) * TAMANHO_PEDACO));
    }
    await SecureStore.setItemAsync(`${chave}.n`, String(total));
    for (let i = total; i < anterior; i++) await SecureStore.deleteItemAsync(`${chave}.${i}`);
  },
  async removeItem(chave) {
    const total = Number((await SecureStore.getItemAsync(`${chave}.n`)) ?? 0);
    for (let i = 0; i < total; i++) await SecureStore.deleteItemAsync(`${chave}.${i}`);
    await SecureStore.deleteItemAsync(`${chave}.n`);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Na web (pré-visualização) não há SecureStore; usa o localStorage padrão.
    storage: Platform.OS === 'web' ? undefined : armazenamentoSeguro,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Recomendação do Supabase para apps nativos: só renova o token com o app em primeiro plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
