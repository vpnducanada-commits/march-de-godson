import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
  subscribeToNewMessages,
} from '../lib/api';
import type { Conversation, Message } from '../lib/types';
import { timeAgo } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Messagerie acheteur ↔ vendeur (temps réel Supabase Realtime).
 * Mobile : liste puis fil (navigation), desktop : deux volets côte à côte.
 */
export default function Messages() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  usePageMeta('Messages', 'Échangez en direct avec les acheteurs et vendeurs de GODSON Marketplace.');

  const userId = session?.user.id;
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(() => {
    if (!userId) return;
    setListError(null);
    fetchConversations(userId)
      .then(setConvs)
      .catch((e) => setListError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [userId]);

  // Liste des conversations + rafraîchissement temps réel.
  useEffect(() => {
    if (!userId) return;
    loadConvs();
    const unsub = subscribeToNewMessages(() => loadConvs());
    return unsub;
  }, [userId, loadConvs]);

  // Fil de la conversation active : chargement + temps réel + marquage « lu ».
  useEffect(() => {
    if (!id) {
      setMsgs(null);
      return;
    }
    setMsgs(null);
    let unsub: (() => void) | null = null;
    let cancelled = false;
    fetchMessages(id)
      .then((m) => {
        if (cancelled) return;
        setMsgs(m);
        if (m.some((x) => x.sender_id !== userId)) void markConversationRead(id);
        loadConvs();
        unsub = subscribeToConversation(id, (nm) => {
          setMsgs((prev) => (prev ? [...prev, nm] : [nm]));
          if (nm.sender_id !== userId) void markConversationRead(id);
          loadConvs();
        });
      })
      .catch((e) => {
        if (!cancelled) setListError(e instanceof Error ? e.message : 'Messages indisponibles.');
      });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [id, userId, loadConvs]);

  // Défilement automatique vers le dernier message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  if (!userId) {
    return (
      <div className="container">
        <EmptyState
          icon="send"
          title="Messages"
          message="Connectez-vous pour échanger en direct avec les acheteurs et les vendeurs."
          action={<Link to="/connexion" className="btn btn--primary">Se connecter</Link>}
        />
      </div>
    );
  }

  const active = convs?.find((c) => c.id === id) ?? null;

  const onSend = async () => {
    if (!id || !draft.trim() || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(userId, id, draft);
      setMsgs((prev) => (prev ? [...prev, m] : [m]));
      setDraft('');
      loadConvs();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-sub">
            Échangez en direct avec votre interlocuteur, sans partager vos coordonnées avant
            d'être prêt.
          </p>
        </div>
      </div>

      <div className={`chat${id ? ' chat--split' : ''}`}>
        {/* LISTE DES CONVERSATIONS */}
        <aside className="chat__list" aria-label="Conversations">
          {listError && <EmptyState icon="alert" title="Chargement impossible" message={listError} />}
          {!listError && convs === null && <Spinner label="Chargement des conversations…" />}
          {!listError && convs && convs.length === 0 && (
            <EmptyState
              icon="send"
              title="Aucune conversation"
              message="Ouvrez une annonce et cliquez sur « Message le vendeur » pour démarrer une conversation."
            />
          )}
          {!listError &&
            convs &&
            convs.length > 0 &&
            convs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chat__conv${c.id === id ? ' chat__conv--active' : ''}`}
                onClick={() => navigate(`/messages/${c.id}`)}
              >
                <span className="chat__conv-thumb" aria-hidden="true">
                  {c.listingImage ? <img src={c.listingImage} alt="" /> : <Icon name="tag" size={18} />}
                </span>
                <span className="chat__conv-main">
                  <span className="chat__conv-title">{c.listingTitle}</span>
                  <span className="chat__conv-sub">
                    {c.counterpart?.display_name || 'Interlocuteur'}
                    {c.lastMessage ? ` — ${c.lastMessage.body}` : ' — Aucun message'}
                  </span>
                </span>
                {c.unreadCount > 0 && <span className="chat__badge" aria-label={`${c.unreadCount} non-lus`}>{c.unreadCount}</span>}
              </button>
            ))}
        </aside>

        {/* FIL DE MESSAGES */}
        <section className="chat__thread" aria-label="Messages de la conversation">
          {id ? (
            <>
              <header className="chat__head">
                <button
                  type="button"
                  className="icon-btn chat__back"
                  aria-label="Retour aux conversations"
                  onClick={() => navigate('/messages')}
                >
                  <Icon name="chevron-left" size={18} />
                </button>
                <div className="chat__head-info">
                  <p className="chat__head-title">{active?.listingTitle || 'Conversation'}</p>
                  <p className="chat__head-sub">
                    {active?.counterpart?.display_name || 'Interlocuteur'}
                  </p>
                </div>
                {active && (
                  <Link className="chat__head-link" to={`/annonce/${active.listingSlug}`}>
                    Voir l'annonce
                  </Link>
                )}
              </header>
              <div className="chat__msgs" role="log" aria-label="Messages">
                {msgs === null && <Spinner label="Chargement des messages…" />}
                {msgs && msgs.length === 0 && (
                  <EmptyState icon="send" title="Aucun message" message="Envoyez le premier message à votre interlocuteur." />
                )}
                {msgs &&
                  msgs.map((m) => (
                    <div
                      key={m.id}
                      className={`chat__bubble${m.sender_id === userId ? ' chat__bubble--me' : ''}`}
                    >
                      <p>{m.body}</p>
                      <time dateTime={m.created_at}>{timeAgo(m.created_at)}</time>
                    </div>
                  ))}
                <div ref={bottomRef} />
              </div>
              <form
                className="chat__composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSend();
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrivez votre message…"
                  maxLength={2000}
                  aria-label="Votre message"
                  autoComplete="off"
                />
                <button type="submit" className="btn btn--primary" disabled={sending || !draft.trim()}>
                  <Icon name="send" size={16} /> {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </form>
            </>
          ) : (
            <div className="chat__placeholder">
              <EmptyState
                icon="send"
                title="Sélectionnez une conversation"
                message="Choisissez une conversation pour afficher et répondre aux messages."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
