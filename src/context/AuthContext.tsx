import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchOwnProfile } from '../lib/api';
import type { Profile } from '../lib/types';

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  loading: true,
  isBanned: false,
  isAdmin: false,
  signOut: async () => undefined,
  refreshProfile: async () => undefined,
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // `booting` : restauration initiale de la session (une seule fois).
  const [booting, setBooting] = useState(true);
  // `profileLoading` : chargement du profil courant pour la session active.
  const [profileLoading, setProfileLoading] = useState(false);
  // Séquenceur anti-course : seul le dernier chargement demandé peut s'écrire.
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const seq = ++loadSeq.current;
    setProfileLoading(true);
    try {
      const p = await fetchOwnProfile(userId);
      if (loadSeq.current === seq) setProfile(p);
    } catch {
      if (loadSeq.current === seq) setProfile(null);
    } finally {
      if (loadSeq.current === seq) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) void loadProfile(data.session.user.id);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (newSession?.user) {
        void loadProfile(newSession.user.id);
      } else {
        loadSeq.current++; // invalide tout chargement en cours
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    loadSeq.current++;
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value: AuthCtx = {
    session,
    profile,
    // Chargé = session restaurée ET profil courant résolu (ou session nulle).
    loading: booting || (session != null && profileLoading),
    isBanned: profile?.is_banned ?? false,
    isAdmin: profile?.role === 'admin',
    signOut,
    refreshProfile,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
