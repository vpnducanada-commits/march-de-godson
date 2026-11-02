import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchFollowSummary, toggleFollowUser } from '../lib/api';

interface FollowButtonProps {
  targetUserId: string;
  targetName?: string | null;
  size?: 'sm' | 'md';
  showCount?: boolean;
  onChange?: (state: { isFollowing: boolean; followersCount: number }) => void;
}

export function FollowButton({
  targetUserId,
  targetName,
  size = 'md',
  showCount = true,
  onChange,
}: FollowButtonProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const viewerId = session?.user.id ?? null;
  const isSelf = viewerId === targetUserId;

  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetchFollowSummary(targetUserId, viewerId)
      .then((res) => {
        if (!active) return;
        setIsFollowing(res.isFollowing);
        setFollowersCount(res.followersCount);
        setLoaded(true);
        onChange?.({ isFollowing: res.isFollowing, followersCount: res.followersCount });
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, viewerId]);

  if (isSelf) {
    if (!showCount || !loaded) return null;
    return (
      <span className="follow-pill follow-pill--self" title="Vos abonnés">
        <Icon name="users" size={14} />
        <span>
          {followersCount} abonné{followersCount > 1 ? 's' : ''}
        </span>
      </span>
    );
  }

  const onToggle = async () => {
    if (!viewerId) {
      toast(
        'info',
        'Connectez-vous pour suivre ce vendeur et recevoir une notification à chaque annonce.',
      );
      navigate('/connexion');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggleFollowUser(viewerId, targetUserId);
      const nextCount = Math.max(0, followersCount + (next ? 1 : -1));
      setIsFollowing(next);
      setFollowersCount(nextCount);
      onChange?.({ isFollowing: next, followersCount: nextCount });
      if (next) {
        toast(
          'success',
          `Vous suivez désormais ${targetName || 'ce vendeur'}. Vous serez alerté à chaque nouvelle annonce.`,
        );
        // Demande facultative de permission de notification navigateur
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          void Notification.requestPermission().catch(() => undefined);
        }
      } else {
        toast('info', `Vous ne suivez plus ${targetName || 'ce vendeur'}.`);
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy || !loaded}
      className={`btn follow-btn ${isFollowing ? 'follow-btn--active' : 'btn--primary'} ${size === 'sm' ? 'btn--sm' : ''}`}
      aria-pressed={isFollowing}
    >
      <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={size === 'sm' ? 14 : 16} />
      <span>{busy ? '…' : isFollowing ? 'Suivi' : 'Suivre'}</span>
      {showCount && loaded && (
        <span className="follow-btn__count" aria-label={`${followersCount} abonnés`}>
          {followersCount}
        </span>
      )}
    </button>
  );
}
