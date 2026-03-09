import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';
import {
  addSocialPostComment,
  copySocialRoutineToLocal,
  followSocialProfile,
  getSocialProfileByUsername,
  listFriendConnections,
  listFollowingUserIds,
  listSocialPostComments,
  listSocialRoutinesByOwner,
  listSocialWorkoutPosts,
  respondFriendRequest,
  sendFriendRequest,
  toggleLikeOnSocialPost,
  unfollowSocialProfile,
  type SocialFriendConnection,
  type SocialPostComment,
  type SocialProfile,
  type SocialRoutine,
  type SocialWorkoutPost
} from '../data/social';

function SocialAvatar({
  avatarUrl,
  label,
  large = false
}: {
  avatarUrl?: string;
  label: string;
  large?: boolean;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label}
        className={large ? 'social-avatar social-avatar-large' : 'social-avatar'}
      />
    );
  }

  return (
    <div
      className={
        large ? 'social-avatar social-avatar-large social-avatar-fallback' : 'social-avatar social-avatar-fallback'
      }
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

export function SocialProfilePage() {
  const { username = '' } = useParams();
  const normalizedUsername = username.replace(/^@+/, '').trim();
  const auth = useAuth();
  const sync = useSync();
  const navigate = useNavigate();
  const userId = auth.status === 'authenticated' && auth.user ? auth.user.id : null;

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<SocialWorkoutPost[]>([]);
  const [routines, setRoutines] = useState<SocialRoutine[]>([]);
  const [following, setFollowing] = useState(false);
  const [friendConnection, setFriendConnection] = useState<SocialFriendConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyingRoutineId, setCopyingRoutineId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commentsPost, setCommentsPost] = useState<SocialWorkoutPost | null>(null);
  const [comments, setComments] = useState<SocialPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId || !normalizedUsername) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const targetProfile = await getSocialProfileByUsername(normalizedUsername);
        if (!targetProfile) {
          if (active) {
            setProfile(null);
            setPosts([]);
            setRoutines([]);
            setFriendConnection(null);
            setError('No encontramos este perfil.');
          }
          return;
        }

        const [nextPosts, nextRoutines, followingIds, friendships] = await Promise.all([
          listSocialWorkoutPosts(userId, { ownerUserId: targetProfile.userId, limit: 60 }),
          listSocialRoutinesByOwner(targetProfile.userId, 30),
          listFollowingUserIds(userId),
          listFriendConnections(userId)
        ]);

        if (!active) return;
        setProfile(targetProfile);
        setPosts(nextPosts);
        setRoutines(nextRoutines);
        setFollowing(followingIds.has(targetProfile.userId));
        setFriendConnection(
          friendships.find((item) => item.userId === targetProfile.userId) ?? null
        );
      } catch {
        if (!active) return;
        setError('No se pudo cargar el perfil social.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [userId, normalizedUsername]);

  const patchPost = (postId: string, updater: (post: SocialWorkoutPost) => SocialWorkoutPost) => {
    setPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
    setCommentsPost((current) => (current && current.id === postId ? updater(current) : current));
  };

  const handleToggleFollow = async () => {
    if (!userId || !profile || profile.userId === userId) return;
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowSocialProfile(userId, profile.userId);
        setFollowing(false);
      } else {
        await followSocialProfile(userId, profile.userId);
        setFollowing(true);
      }
    } catch {
      setError('No se pudo actualizar el follow.');
    } finally {
      setFollowBusy(false);
    }
  };

  const refreshFriendConnection = async () => {
    if (!userId || !profile) return;
    const friendships = await listFriendConnections(userId);
    setFriendConnection(friendships.find((item) => item.userId === profile.userId) ?? null);
  };

  const handleSendFriendRequest = async () => {
    if (!userId || !profile || profile.userId === userId) return;
    setFollowBusy(true);
    try {
      await sendFriendRequest(userId, profile.userId);
      await refreshFriendConnection();
    } catch {
      setError('No se pudo enviar la solicitud de amistad.');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleRespondFriendRequest = async (decision: 'accepted' | 'rejected') => {
    if (!userId || !friendConnection || friendConnection.status !== 'incoming_pending') return;
    setFollowBusy(true);
    try {
      await respondFriendRequest(userId, friendConnection.id, decision);
      await refreshFriendConnection();
    } catch {
      setError('No se pudo responder la solicitud.');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCopyRoutine = async (routine: SocialRoutine) => {
    setCopyingRoutineId(routine.id);
    setError(null);
    try {
      const copied = await copySocialRoutineToLocal(routine.id);
      alert(`Rutina copiada como "${copied.importedName}".`);
      navigate(`/routines/${copied.routineId}`);
    } catch {
      setError('No se pudo copiar esta rutina.');
    } finally {
      setCopyingRoutineId(null);
    }
  };

  const handleToggleLike = async (post: SocialWorkoutPost) => {
    if (!userId) return;
    try {
      const liked = await toggleLikeOnSocialPost(userId, post.id);
      patchPost(post.id, (current) => ({
        ...current,
        likedByMe: liked,
        likeCount: Math.max(0, current.likeCount + (liked ? 1 : -1))
      }));
    } catch {
      setError('No se pudo actualizar el like.');
    }
  };

  const openComments = async (post: SocialWorkoutPost) => {
    setCommentsPost(post);
    setComments([]);
    setNewComment('');
    setCommentsLoading(true);
    try {
      const data = await listSocialPostComments(post.id);
      setComments(data);
    } catch {
      setError('No se pudieron cargar los comentarios.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!userId || !commentsPost || !newComment.trim()) return;
    setCommentBusy(true);
    try {
      await addSocialPostComment(userId, commentsPost.id, newComment);
      const data = await listSocialPostComments(commentsPost.id);
      setComments(data);
      setNewComment('');
      patchPost(commentsPost.id, (current) => ({
        ...current,
        commentCount: data.length
      }));
    } catch {
      setError('No se pudo enviar el comentario.');
    } finally {
      setCommentBusy(false);
    }
  };

  if (!userId) {
    return (
      <section className="stack wide">
        <div className="card">
          <h1>Perfil social</h1>
          <p className="muted">Debes iniciar sesión para ver perfiles públicos.</p>
          <div className="actions">
            <button className="primary-button" type="button" onClick={sync.openAccountDialog}>
              Entrar o crear cuenta
            </button>
            <Link className="ghost-button" to="/social">
              Volver a Social
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="stack wide social-page">
      <div className="card social-hero-card">
        <div className="social-hero-header">
          <div>
            <p className="metric-label">Perfil social</p>
            <h1>@{normalizedUsername || 'usuario'}</h1>
          </div>
          <Link className="ghost-button" to="/social">
            Volver
          </Link>
        </div>

        {loading ? <p className="muted">Cargando perfil...</p> : null}
        {error ? <p className="warning">{error}</p> : null}

        {!loading && profile ? (
          <>
            <article className="social-summary-card">
              <div className="social-profile-head">
                <SocialAvatar avatarUrl={profile.avatarUrl} label={profile.displayName} large />
                <div>
                  <p className="metric-value social-display-name">{profile.displayName}</p>
                  <p className="muted">@{profile.username}</p>
                </div>
              </div>
              <p className="muted social-bio-preview">{profile.bio || 'Sin bio por ahora.'}</p>
              <div className="actions">
                {profile.userId === userId ? (
                  <Link className="ghost-button" to="/settings">
                    Editar en Ajustes
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      className={following ? 'ghost-button' : 'primary-button'}
                      onClick={() => void handleToggleFollow()}
                      disabled={followBusy}
                    >
                      {followBusy ? 'Guardando...' : following ? 'Siguiendo' : 'Seguir'}
                    </button>
                    {!friendConnection || friendConnection.status === 'none' ? (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleSendFriendRequest()}
                        disabled={followBusy}
                      >
                        {followBusy ? 'Guardando...' : 'Agregar amigo'}
                      </button>
                    ) : null}
                    {friendConnection?.status === 'outgoing_pending' ? (
                      <button type="button" className="ghost-button" disabled>
                        Solicitud enviada
                      </button>
                    ) : null}
                    {friendConnection?.status === 'incoming_pending' ? (
                      <>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void handleRespondFriendRequest('accepted')}
                          disabled={followBusy}
                        >
                          {followBusy ? 'Guardando...' : 'Aceptar amistad'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleRespondFriendRequest('rejected')}
                          disabled={followBusy}
                        >
                          Rechazar
                        </button>
                      </>
                    ) : null}
                    {friendConnection?.status === 'friends' ? (
                      <span className="pill active">Amigos</span>
                    ) : null}
                  </>
                )}
              </div>
            </article>

            <article className="social-summary-card">
              <p className="metric-label">Publicaciones</p>
              {!posts.length ? <p className="muted">Sin publicaciones todavía.</p> : null}
              <div className="stack social-post-list">
                {posts.map((post) => (
                  <article key={post.id} className="social-post-card">
                    <div className="social-post-body">
                      <p className="social-post-title">{post.routineName ?? 'Entrenamiento'}</p>
                      {post.caption ? <p className="social-post-caption">{post.caption}</p> : null}
                      <div className="social-post-metrics">
                        <span>{post.summary.durationMinutes} min</span>
                        <span>{post.summary.setCount} sets</span>
                        <span>{post.summary.totalReps} reps</span>
                        <span>{post.summary.totalVolume} kg</span>
                      </div>
                    </div>
                    <footer className="social-post-actions">
                      <button
                        type="button"
                        className={post.likedByMe ? 'toggle active' : 'ghost-button'}
                        onClick={() => void handleToggleLike(post)}
                      >
                        Me gusta · {post.likeCount}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void openComments(post)}
                      >
                        Comentarios · {post.commentCount}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            </article>

            <article className="social-summary-card">
              <p className="metric-label">Rutinas públicas</p>
              {!routines.length ? <p className="muted">No hay rutinas públicas.</p> : null}
              <div className="stack social-routine-list">
                {routines.map((routine) => (
                  <article key={routine.id} className="social-routine-card">
                    <div className="social-routine-head">
                      <div>
                        <h3>{routine.title}</h3>
                        <p className="muted">
                          Publicada: {new Date(routine.publishedAt).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleCopyRoutine(routine)}
                        disabled={copyingRoutineId === routine.id}
                      >
                        {copyingRoutineId === routine.id ? 'Copiando...' : 'Copiar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </>
        ) : null}
      </div>

      {commentsPost ? (
        <div className="modal-overlay center" onClick={() => setCommentsPost(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="stack">
              <h2>Comentarios</h2>
              {commentsLoading ? <p className="muted">Cargando comentarios...</p> : null}
              {!commentsLoading && !comments.length ? (
                <p className="muted">Sé el primero en comentar.</p>
              ) : null}
              {!commentsLoading && comments.length ? (
                <div className="social-comments-list">
                  {comments.map((comment) => (
                    <article key={comment.id} className="social-comment-item">
                      <div className="social-profile-head">
                        <SocialAvatar avatarUrl={comment.avatarUrl} label={comment.displayName} />
                        <div>
                          <p className="metric-value social-display-name">{comment.displayName}</p>
                          <p className="muted">@{comment.username}</p>
                        </div>
                      </div>
                      <p>{comment.content}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              <div className="field">
                <label className="label" htmlFor="social-profile-comment-input">
                  Nuevo comentario
                </label>
                <textarea
                  id="social-profile-comment-input"
                  rows={2}
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Escribe un comentario..."
                />
              </div>
              <div className="actions">
                <button type="button" className="ghost-button" onClick={() => setCommentsPost(null)}>
                  Cerrar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleSendComment()}
                  disabled={commentBusy || !newComment.trim()}
                >
                  {commentBusy ? 'Enviando...' : 'Comentar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
