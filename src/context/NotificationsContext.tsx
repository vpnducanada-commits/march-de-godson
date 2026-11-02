import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  clearUserNotifications,
  demoMode,
  fetchConversations,
  fetchSellerListings,
  fetchUnreadCount,
  fetchUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  subscribeToNewMessages,
  subscribeToUserNotifications,
} from '../lib/api';
import type { Conversation, ListingFull, ListingStatus, UserNotification } from '../lib/types';

/**
 * Centre de notifications — agrège, pour l'utilisateur connecté :
 * 1. **Messages non lus** (suivis en temps réel par `fetchUnreadCount` + canal partagé)
 * 2. **Nouvelles annonces des vendeurs suivis** (`public.user_notifications` + Supabase Realtime)
 * 3. **Événements de statut d'annonce** (passage en ligne, refus, archivage)
 *
 * Aucune donnée inventée : tout provient de la base Supabase et des annonces réelles.
 */
export interface ListingEvent {
  key: string;
  listingId: string;
  slug: string;
  title: string;
  oldStatus: ListingStatus;
  newStatus: ListingStatus;
  updatedAt: string;
}

interface Snapshot {
  statuses: Record<string, ListingStatus>;
  unseen: ListingEvent[];
}

interface NotificationsState {
  ready: boolean;
  unreadTotal: number;
  unreadConversations: Conversation[];
  listingEvents: ListingEvent[];
  userNotifications: UserNotification[];
  unreadFollowNotifs: number;
  total: number;
  markEventsRead: () => void;
  markFollowNotifRead: (id: string) => Promise<void>;
  markAllFollowNotifsRead: () => Promise<void>;
  clearFollowNotifs: () => Promise<void>;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

const POLL_MS = 60_000;
const MAX_EVENTS = 10;
const MAX_CONVS = 5;

function storageKey(userId: string): string {
  return `gm:notif:${userId}`;
}

function loadSnapshot(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    if (!s || typeof s !== 'object' || !s.statuses) return null;
    s.unseen = Array.isArray(s.unseen) ? s.unseen : [];
    return s;
  } catch {
    return null;
  }
}

function saveSnapshot(userId: string, s: Snapshot): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(s));
  } catch {
    /* stockage plein / privé */
  }
}

function diffEvents(
  snapshot: Snapshot | null,
  items: ListingFull[],
): { snapshot: Snapshot; changed: boolean } {
  if (!snapshot) {
    const statuses: Record<string, ListingStatus> = {};
    for (const it of items) statuses[it.listing.slug] = it.listing.status;
    return { snapshot: { statuses, unseen: [] }, changed: false };
  }
  let changed = false;
  const unseen = [...snapshot.unseen];
  const statuses = { ...snapshot.statuses };
  for (const it of items) {
    const l = it.listing;
    const known = statuses[l.slug];
    if (known === undefined) {
      statuses[l.slug] = l.status;
      changed = true;
      continue;
    }
    if (known !== l.status) {
      statuses[l.slug] = l.status;
      changed = true;
      unseen.unshift({
        key: `${l.slug}:${l.updated_at}`,
        listingId: l.id,
        slug: l.slug,
        title: l.title,
        oldStatus: known,
        newStatus: l.status,
        updatedAt: l.updated_at,
      });
    }
  }
  return { snapshot: { statuses, unseen: unseen.slice(0, MAX_EVENTS) }, changed };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const userId = session?.user.id ?? null;

  const [ready, setReady] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<Conversation[]>([]);
  const [listingEvents, setListingEvents] = useState<ListingEvent[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || demoMode || busy.current) return;
    busy.current = true;
    try {
      const [convs, count, page, dbNotifs] = await Promise.all([
        fetchConversations(userId).catch(() => [] as Conversation[]),
        fetchUnreadCount().catch(() => 0),
        fetchSellerListings(userId, { pageSize: 100 }).catch(() => null),
        fetchUserNotifications(userId).catch(() => [] as UserNotification[]),
      ]);

      const unread = convs
        .filter((c) => c.unreadCount > 0)
        .sort((a, b) => {
          const ta = a.lastMessage?.created_at ?? a.created_at;
          const tb = b.lastMessage?.created_at ?? b.created_at;
          return ta < tb ? 1 : -1;
        })
        .slice(0, MAX_CONVS);
      setUnreadConversations(unread);
      setUnreadTotal(count);
      setUserNotifications(dbNotifs);

      if (page) {
        const prev = loadSnapshot(userId);
        const { snapshot } = diffEvents(prev, page.items);
        saveSnapshot(userId, snapshot);
        setListingEvents(snapshot.unseen);
      }
      setReady(true);
    } finally {
      busy.current = false;
    }
  }, [userId]);

  const markEventsRead = useCallback(() => {
    if (!userId) return;
    const s = loadSnapshot(userId);
    if (s) saveSnapshot(userId, { ...s, unseen: [] });
    setListingEvents([]);
  }, [userId]);

  const markFollowNotifRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const nowIso = new Date().toISOString();
      setUserNotifications((prev) =>
        prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: nowIso } : n)),
      );
      await markUserNotificationRead(userId, id);
    },
    [userId],
  );

  const markAllFollowNotifsRead = useCallback(async () => {
    if (!userId) return;
    const nowIso = new Date().toISOString();
    setUserNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })));
    await markAllUserNotificationsRead(userId);
  }, [userId]);

  const clearFollowNotifs = useCallback(async () => {
    if (!userId) return;
    setUserNotifications([]);
    await clearUserNotifications(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || demoMode) {
      setReady(false);
      setUnreadTotal(0);
      setUnreadConversations([]);
      setListingEvents([]);
      setUserNotifications([]);
      return;
    }
    setReady(false);
    void refresh();

    const unsubMsg = subscribeToNewMessages(() => void refresh());
    const unsubFollowNotifs = subscribeToUserNotifications(userId, (notif) => {
      setUserNotifications((prev) => {
        if (prev.some((x) => x.id === notif.id)) return prev;
        return [notif, ...prev].slice(0, 50);
      });
      toast('info', `${notif.title}${notif.body ? ` — ${notif.body}` : ''}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(notif.title, {
            body: notif.body || 'Voir sur GODSON Marketplace',
            icon: '/icons/icon-192.png',
          });
        } catch {
          /* ignore sur WebView sans constructeur Notification */
        }
      }
    });

    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubMsg();
      unsubFollowNotifs();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unreadFollowNotifs = userNotifications.filter((n) => !n.read_at).length;
  const total = unreadTotal + listingEvents.length + unreadFollowNotifs;

  return (
    <NotificationsContext.Provider
      value={{
        ready,
        unreadTotal,
        unreadConversations,
        listingEvents,
        userNotifications,
        unreadFollowNotifs,
        total,
        markEventsRead,
        markFollowNotifRead,
        markAllFollowNotifsRead,
        clearFollowNotifs,
        refresh,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications doit être utilisé dans <NotificationsProvider>');
  }
  return ctx;
}
