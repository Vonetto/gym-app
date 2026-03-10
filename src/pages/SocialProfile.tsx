import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SocialAvatar } from '../components/SocialAvatar';
import { SocialPostCard } from '../components/SocialPostCard';
import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';
import {
  addSocialPostComment,
  copySocialRoutineToLocal,
  followSocialProfile,
  getSocialRelationshipCounts,
  getSocialProfileByUsername,
  listFriendConnections,
  listFollowingUserIds,
  listSocialRelationMembers,
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
  type SocialRelationshipCounts,
  type SocialRoutine,
  type SocialWorkoutPost
} from '../data/social';

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
  const [relationshipCounts, setRelationshipCounts] = useState<SocialRelationshipCounts>({
    followers: 0,
    following: 0,
    friends: 0
  });
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
  const [relationModal, setRelationModal] = useState<{
    title: string;
    loading: boolean;
    items: SocialProfile[];
  } | null>(null);

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

        const [nextPosts, nextRoutines, followingIds, friendships, counts] = await Promise.all([
          listSocialWorkoutPosts(userId, { ownerUserId: targetProfile.userId, limit: 60 }),
          listSocialRoutinesByOwner(targetProfile.userId, 30),
          listFollowingUserIds(userId),
          listFriendConnections(userId),
          getSocialRelationshipCounts(targetProfile.userId)
        ]);

        if (!active) return;
        setProfile(targetProfile);
        setPosts(nextPosts);
        setRoutines(nextRoutines);
        setFollowing(followingIds.has(targetProfile.userId));
        setFriendConnection(
          friendships.find((item) => item.userId === targetProfile.userId) ?? null
        );
        setRelationshipCounts(counts);
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
      setRelationshipCounts(await getSocialRelationshipCounts(profile.userId));
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
      setRelationshipCounts(await getSocialRelationshipCounts(profile.userId));
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
      if (profile) {
        setRelationshipCounts(await getSocialRelationshipCounts(profile.userId));
      }
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

  const openRelations = async (relation: 'followers' | 'following' | 'friends') => {
    if (!profile) return;
    const titleMap = {
      followers: 'Seguidores',
      following: 'Siguiendo',
      friends: 'Amigos'
    } as const;
    setRelationModal({
      title: titleMap[relation],
      loading: true,
      items: []
    });
    try {
      const members = await listSocialRelationMembers(relation, profile.userId);
      setRelationModal({
        title: titleMap[relation],
        loading: false,
        items: members
      });
    } catch {
      setRelationModal({
        title: titleMap[relation],
        loading: false,
        items: []
      });
      setError('No se pudieron cargar las relaciones.');
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
                  <div className="social-counter-row ig-style">
                    <button
                      type="button"
                      className="ghost-button social-counter-pill"
                      onClick={() => void openRelations('followers')}
                    >
                      <strong>{relationshipCounts.followers}</strong> seguidores
                    </button>
                    <button
                      type="button"
                      className="ghost-button social-counter-pill"
                      onClick={() => void openRelations('following')}
                    >
                      <strong>{relationshipCounts.following}</strong> siguiendo
                    </button>
                    <button
                      type="button"
                      className="ghost-button social-counter-pill"
                      onClick={() => void openRelations('friends')}
                    >
                      <strong>{relationshipCounts.friends}</strong> amigos
                    </button>
                  </div>
                </div>
              </div>
              <p className="muted social-bio-preview">{profile.bio || 'Sin bio por ahora.'}</p>
              <div className="actions social-actions-grid">
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
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    onLike={handleToggleLike}
                    onComment={openComments}
                    onProfile={(item) => navigate(`/social/${item.authorUsername}`)}
                  />
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

      {relationModal ? (
        <div className="modal-overlay center" onClick={() => setRelationModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="stack">
              <h2>{relationModal.title}</h2>
              {relationModal.loading ? <p className="muted">Cargando...</p> : null}
              {!relationModal.loading && !relationModal.items.length ? (
                <p className="muted">No hay perfiles para mostrar.</p>
              ) : null}
              {!relationModal.loading && relationModal.items.length ? (
                <div className="social-comments-list">
                  {relationModal.items.map((item) => (
                    <button
                      key={item.userId}
                      type="button"
                      className="social-comment-item social-relation-item"
                      onClick={() => {
                        setRelationModal(null);
                        navigate(`/social/${item.username}`);
                      }}
                    >
                      <div className="social-profile-head">
                        <SocialAvatar avatarUrl={item.avatarUrl} label={item.displayName} />
                        <div>
                          <p className="metric-value social-display-name">{item.displayName}</p>
                          <p className="muted">@{item.username}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="actions">
                <button type="button" className="ghost-button" onClick={() => setRelationModal(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
