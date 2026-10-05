import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

const CHAVE_BIOMETRIA = 'zampieri.biometria';
// Depois de quanto tempo em segundo plano o app volta a pedir a biometria.
const BLOQUEIO_APOS_MS = 2 * 60 * 1000;

type Biometria = { disponivel: boolean; nome: string; ativa: boolean };

type Sessao = {
  pronto: boolean;
  usuarioId: string | null;
  telefone: string | null;
  /** Biometria ativa e ainda não confirmada nesta abertura do app. */
  bloqueado: boolean;
  biometria: Biometria;
  desbloquear: () => Promise<boolean>;
  definirBiometria: (ativa: boolean) => Promise<boolean>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

async function lerPreferencia() {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(CHAVE_BIOMETRIA)) === '1';
}

async function gravarPreferencia(ativa: boolean) {
  if (Platform.OS === 'web') return;
  if (ativa) await SecureStore.setItemAsync(CHAVE_BIOMETRIA, '1');
  else await SecureStore.deleteItemAsync(CHAVE_BIOMETRIA);
}

async function detectarBiometria(): Promise<Omit<Biometria, 'ativa'>> {
  if (Platform.OS === 'web') return { disponivel: false, nome: 'biometria' };
  const [hardware, cadastrada, tipos] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const T = LocalAuthentication.AuthenticationType;
  const nome = tipos.includes(T.FACIAL_RECOGNITION)
    ? Platform.OS === 'ios'
      ? 'Face ID'
      : 'reconhecimento facial'
    : tipos.includes(T.FINGERPRINT)
      ? Platform.OS === 'ios'
        ? 'Touch ID'
        : 'digital'
      : 'biometria';
  return { disponivel: hardware && cadastrada, nome };
}

async function autenticar(motivo: string) {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: motivo,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar senha do celular',
  });
  return r.success;
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [biometria, setBiometria] = useState<Biometria>({ disponivel: false, nome: 'biometria', ativa: false });
  const foiParaSegundoPlano = useRef<number | null>(null);
  const biometriaAtiva = useRef(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([supabase.auth.getSession(), detectarBiometria(), lerPreferencia()]).then(
      ([{ data }, deteccao, preferencia]) => {
        if (!ativo) return;
        const usuario = data.session?.user ?? null;
        const ativa = Boolean(usuario) && preferencia && deteccao.disponivel;
        biometriaAtiva.current = ativa;
        setUsuarioId(usuario?.id ?? null);
        setTelefone(usuario?.phone ?? null);
        setBiometria({ ...deteccao, ativa });
        setBloqueado(ativa);
        setPronto(true);
      },
    );

    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUsuarioId(sessao?.user.id ?? null);
      setTelefone(sessao?.user.phone ?? null);
      if (!sessao) {
        // Sessão expirou ou foi encerrada: não há o que proteger com biometria.
        biometriaAtiva.current = false;
        setBloqueado(false);
        setBiometria((b) => ({ ...b, ativa: false }));
      }
    });

    // Ao voltar do segundo plano depois de um tempo, pede a biometria de novo.
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') foiParaSegundoPlano.current = Date.now();
      if (estado === 'active' && foiParaSegundoPlano.current !== null) {
        const ausente = Date.now() - foiParaSegundoPlano.current;
        foiParaSegundoPlano.current = null;
        if (biometriaAtiva.current && ausente > BLOQUEIO_APOS_MS) setBloqueado(true);
      }
    });

    return () => {
      ativo = false;
      inscricao.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const desbloquear = useCallback(async () => {
    const ok = await autenticar('Desbloquear o app do Colégio Zampieri');
    if (ok) setBloqueado(false);
    return ok;
  }, []);

  const definirBiometria = useCallback(
    async (ativa: boolean) => {
      // Ativar exige confirmar a biometria agora, para não trancar a pessoa fora do app.
      if (ativa && !(await autenticar(`Ativar ${biometria.nome}`))) return false;
      await gravarPreferencia(ativa);
      biometriaAtiva.current = ativa;
      setBiometria((b) => ({ ...b, ativa }));
      return true;
    },
    [biometria.nome],
  );

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    await gravarPreferencia(false);
    biometriaAtiva.current = false;
    setBiometria((b) => ({ ...b, ativa: false }));
    setBloqueado(false);
  }, []);

  const valor = useMemo(
    () => ({ pronto, usuarioId, telefone, bloqueado, biometria, desbloquear, definirBiometria, sair }),
    [pronto, usuarioId, telefone, bloqueado, biometria, desbloquear, definirBiometria, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao fora do SessaoProvider');
  return ctx;
}
