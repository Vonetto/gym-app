import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SocialAvatar } from '../components/SocialAvatar';
import { SocialPostCard } from '../components/SocialPostCard';
import { useAuth } from '../data/AuthProvider';
import { useSync } from '../data/SyncProvider';
import { listRecentWorkouts } from '../data/workouts';
import {
  addSocialPostComment,
  deleteSocialPost,
  followSocialProfile,
  getSocialRelationshipCounts,
  getMySocialProfile,
  listIncomingFriendRequests,
  listSocialRelationMembers,
  listFriendConnections,
  listFollowingUserIds,
  respondFriendRequest,
  sendFriendRequest,
  listSocialPostComments,
  listSocialProfiles,
  listSocialRoutinesByOwner,
  listSocialWorkoutPosts,
  publishWorkoutPostToSocial,
  setSocialPostHidden,
  toggleLikeOnSocialPost,
  unfollowSocialProfile,
  type SocialDirectoryProfile,
  type SocialFriendConnection,
  type SocialPostComment,
  type SocialProfile,
  type SocialFriendRequest,
  type SocialRoutine,
  type SocialWorkoutPost,
  type SocialRelationshipCounts
} from '../data/social';

type SocialTab = 'feed' | 'discover' | 'me';
type FeedMode = 'for_you' | 'following' | 'friends';

interface LocalWorkoutOption {
  id: string;
  routineName: string;
  endedAt: string;
}

export function Social() {
  const auth = useAuth();
  const sync = useSync();
  const navigate = useNavigate();
  const userId = auth.status === 'authenticated' && auth.user ? auth.user.id : null;

  const [activeTab, setActiveTab] = useState<SocialTab>('feed');
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you');
  const [feedSearch, setFeedSearch] = useState('');
  const [discoverSearch, setDiscoverSearch] = useState('');

  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [followBusyUserId, setFollowBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myProfile, setMyProfile] = useState<SocialProfile | null>(null);
  const [feedPosts, setFeedPosts] = useState<SocialWorkoutPost[]>([]);
  const [discoverProfiles, setDiscoverProfiles] = useState<SocialDirectoryProfile[]>([]);
  const [myPosts, setMyPosts] = useState<SocialWorkoutPost[]>([]);
  const [myRoutines, setMyRoutines] = useState<SocialRoutine[]>([]);
  const [myWorkouts, setMyWorkouts] = useState<LocalWorkoutOption[]>([]);
  const [myRelationshipCounts, setMyRelationshipCounts] = useState<SocialRelationshipCounts>({
    followers: 0,
    following: 0,
    friends: 0
  });
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<SocialFriendRequest[]>([]);
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [friendConnections, setFriendConnections] = useState<Map<string, SocialFriendConnection>>(
    new Map()
  );

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostImages, setNewPostImages] = useState<File[]>([]);

  const [commentsPost, setCommentsPost] = useState<SocialWorkoutPost | null>(null);
  const [comments, setComments] = useState<SocialPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [postActionBusyId, setPostActionBusyId] = useState<string | null>(null);
  const [relationModal, setRelationModal] = useState<{
    title: string;
    loading: boolean;
    items: SocialProfile[];
  } | null>(null);

  const loadFeed = async () => {
    if (!userId) return;
    setLoadingFeed(true);
    try {
      const data = await listSocialWorkoutPosts(userId, {
        mode: feedMode,
        search: feedSearch,
        limit: 60
      });
      setFeedPosts(data);
    } catch {
      setError('No se pudo cargar el feed social.');
    } finally {
      setLoadingFeed(false);
    }
  };

  const loadDiscover = async () => {
    if (!userId) return;
    setLoadingDiscover(true);
    try {
      const [profiles, following, friendships] = await Promise.all([
        listSocialProfiles(userId, discoverSearch),
        listFollowingUserIds(userId),
        listFriendConnections(userId)
      ]);
      setDiscoverProfiles(profiles);
      setFollowingUserIds(following);
      setFriendConnections(new Map(friendships.map((item) => [item.userId, item])));
    } catch {
      setError('No se pudo cargar el directorio de perfiles.');
    } finally {
      setLoadingDiscover(false);
    }
  };

  const loadMine = async () => {
    if (!userId) return;
    setLoadingMine(true);
    try {
      const [profile, posts, routines, workouts, requests, relationshipCounts] = await Promise.all([
        getMySocialProfile(userId),
        listSocialWorkoutPosts(userId, { ownerUserId: userId, limit: 60, includeHidden: true }),
        listSocialRoutinesByOwner(userId, 30),
        listRecentWorkouts(20),
        listIncomingFriendRequests(userId),
        getSocialRelationshipCounts(userId)
      ]);
      setMyProfile(profile);
      setMyPosts(posts);
      setMyRoutines(routines);
      setIncomingFriendRequests(requests);
      const workoutOptions = workouts.map((workout) => ({
        id: workout.id,
        routineName: workout.routineName ?? 'Entrenamiento',
        endedAt: workout.endedAt
      }));
      setMyWorkouts(workoutOptions);
      setSelectedWorkoutId((current) => current || workoutOptions[0]?.id || '');
      setMyRelationshipCounts(relationshipCounts);
    } catch {
      setError('No se pudo cargar tu perfil social.');
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    void loadMine();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const timeoutId = window.setTimeout(() => {
      void loadFeed();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [userId, feedMode, feedSearch]);

  useEffect(() => {
    if (!userId) return;
    const timeoutId = window.setTimeout(() => {
      void loadDiscover();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [userId, discoverSearch]);

  const patchPost = (
    postId: string,
    updater: (post: SocialWorkoutPost) => SocialWorkoutPost
  ) => {
    setFeedPosts((current) =>
      current.map((post) => (post.id === postId ? updater(post) : post))
    );
    setMyPosts((current) =>
      current.map((post) => (post.id === postId ? updater(post) : post))
    );
    setCommentsPost((current) => (current && current.id === postId ? updater(current) : current));
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

  const handlePublishWorkout = async () => {
    if (!userId || !selectedWorkoutId) return;
    setPublishing(true);
    try {
      await publishWorkoutPostToSocial(userId, selectedWorkoutId, {
        caption: newPostCaption.trim(),
        visibility: 'authenticated',
        imageFiles: newPostImages.length ? newPostImages : undefined
      });
      setNewPostCaption('');
      setNewPostImages([]);
      await Promise.all([loadMine(), loadFeed()]);
      setActiveTab('feed');
    } catch {
      setError('No se pudo publicar el entrenamiento.');
    } finally {
      setPublishing(false);
    }
  };

  const handleTogglePostHidden = async (post: SocialWorkoutPost) => {
    if (!userId) return;
    setPostActionBusyId(post.id);
    try {
      await setSocialPostHidden(userId, post.id, !post.hiddenAt);
      await Promise.all([loadMine(), loadFeed()]);
    } catch {
      setError('No se pudo actualizar la visibilidad de la publicación.');
    } finally {
      setPostActionBusyId(null);
    }
  };

  const handleDeletePost = async (post: SocialWorkoutPost) => {
    if (!userId) return;
    const confirmed = window.confirm('¿Eliminar publicación? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    setPostActionBusyId(post.id);
    try {
      await deleteSocialPost(userId, post.id);
      await Promise.all([loadMine(), loadFeed()]);
    } catch {
      setError('No se pudo eliminar la publicación.');
    } finally {
      setPostActionBusyId(null);
    }
  };

  const handleToggleFollow = async (profile: SocialDirectoryProfile) => {
    if (!userId) return;
    const currentlyFollowing = followingUserIds.has(profile.userId);
    setFollowBusyUserId(profile.userId);
    try {
      if (currentlyFollowing) {
        await unfollowSocialProfile(userId, profile.userId);
      } else {
        await followSocialProfile(userId, profile.userId);
      }
      setFollowingUserIds((current) => {
        const next = new Set(current);
        if (currentlyFollowing) {
          next.delete(profile.userId);
        } else {
          next.add(profile.userId);
        }
        return next;
      });
      setDiscoverProfiles((current) =>
        current.map((entry) =>
          entry.userId === profile.userId
            ? {
                ...entry,
                isFollowing: !currentlyFollowing
              }
            : entry
        )
      );
      if (feedMode === 'following') {
        void loadFeed();
      }
    } catch {
      setError('No se pudo actualizar el follow.');
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!userId) return;
    setFollowBusyUserId(targetUserId);
    try {
      await sendFriendRequest(userId, targetUserId);
      await loadDiscover();
      if (feedMode === 'friends') {
        void loadFeed();
      }
    } catch {
      setError('No se pudo enviar la solicitud de amistad.');
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const handleRespondFriendRequest = async (
    targetUserId: string,
    decision: 'accepted' | 'rejected'
  ) => {
    if (!userId) return;
    const connection = friendConnections.get(targetUserId);
    if (!connection) return;
    setFollowBusyUserId(targetUserId);
    try {
      await respondFriendRequest(userId, connection.id, decision);
      await loadDiscover();
      if (feedMode === 'friends') {
        void loadFeed();
      }
    } catch {
      setError('No se pudo responder la solicitud.');
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const handleRespondIncomingRequest = async (
    request: SocialFriendRequest,
    decision: 'accepted' | 'rejected'
  ) => {
    if (!userId) return;
    setFollowBusyUserId(request.requesterUserId);
    try {
      await respondFriendRequest(userId, request.id, decision);
      await Promise.all([loadMine(), loadDiscover()]);
      if (feedMode === 'friends') {
        void loadFeed();
      }
    } catch {
      setError('No se pudo responder la solicitud.');
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const openRelations = async (
    relation: 'followers' | 'following' | 'friends',
    targetUserId: string
  ) => {
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
      const members = await listSocialRelationMembers(relation, targetUserId);
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
          <h1>Social</h1>
          <p className="muted">
            Debes iniciar sesión para usar feed, perfiles y seguimiento.
          </p>
          <div className="actions">
            <button className="primary-button" type="button" onClick={sync.openAccountDialog}>
              Entrar o crear cuenta
            </button>
            <Link className="ghost-button" to="/profile">
              Ir a Perfil
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
            <p className="metric-label">Social</p>
            <h1>Comunidad</h1>
          </div>
          <Link className="ghost-button" to="/settings">
            Privacidad
          </Link>
        </div>

        <div className="social-tab-switch">
          <button
            type="button"
            className={activeTab === 'feed' ? 'toggle active' : 'toggle'}
            onClick={() => setActiveTab('feed')}
          >
            Feed
          </button>
          <button
            type="button"
            className={activeTab === 'discover' ? 'toggle active' : 'toggle'}
            onClick={() => setActiveTab('discover')}
          >
            Explorar
          </button>
          <button
            type="button"
            className={activeTab === 'me' ? 'toggle active' : 'toggle'}
            onClick={() => setActiveTab('me')}
          >
            Mi perfil
          </button>
        </div>

        {error ? <p className="warning">{error}</p> : null}

        {activeTab === 'feed' ? (
          <div className="stack">
            <div className="social-inline-controls">
              <div className="toggle-group social-feed-mode-switch">
                <button
                  type="button"
                  className={feedMode === 'for_you' ? 'toggle active' : 'toggle'}
                  onClick={() => setFeedMode('for_you')}
                >
                  Para ti
                </button>
                <button
                  type="button"
                  className={feedMode === 'following' ? 'toggle active' : 'toggle'}
                  onClick={() => setFeedMode('following')}
                >
                  Siguiendo
                </button>
                <button
                  type="button"
                  className={feedMode === 'friends' ? 'toggle active' : 'toggle'}
                  onClick={() => setFeedMode('friends')}
                >
                  Amigos
                </button>
              </div>
              <input
                type="text"
                value={feedSearch}
                onChange={(event) => setFeedSearch(event.target.value)}
                placeholder="Buscar en feed..."
              />
            </div>

            {loadingFeed ? <p className="muted">Cargando feed...</p> : null}
            {!loadingFeed && !feedPosts.length ? (
              <p className="muted">
                {feedMode === 'following'
                  ? 'Aún no hay publicaciones de perfiles que sigues.'
                  : feedMode === 'friends'
                    ? 'Aún no hay publicaciones de tus amigos.'
                    : 'Aún no hay publicaciones en el feed.'}
              </p>
            ) : null}
            {!loadingFeed ? (
              <div className="stack social-post-list">
                {feedPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    onLike={handleToggleLike}
                    onComment={openComments}
                    onProfile={(item) => navigate(`/social/${item.authorUsername}`)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'discover' ? (
          <div className="stack">
            <div className="field">
              <label className="label" htmlFor="social-search-profiles">
                Buscar perfiles
              </label>
              <input
                id="social-search-profiles"
                type="text"
                value={discoverSearch}
                onChange={(event) => setDiscoverSearch(event.target.value)}
                placeholder="@usuario o nombre"
              />
            </div>

            {loadingDiscover ? <p className="muted">Buscando perfiles...</p> : null}
            {!loadingDiscover && !discoverProfiles.length ? (
              <p className="muted">No encontramos perfiles con ese criterio.</p>
            ) : null}

            {!loadingDiscover ? (
              <div className="stack social-profile-list">
                {discoverProfiles.map((profile) => {
                  const isFollowing = followingUserIds.has(profile.userId);
                  const friendConnection = friendConnections.get(profile.userId);
                  const friendStatus = friendConnection?.status ?? 'none';
                  const friendBusy = followBusyUserId === profile.userId;
                  return (
                    <article key={profile.userId} className="social-summary-card social-user-card">
                      <div className="social-profile-head">
                        <SocialAvatar avatarUrl={profile.avatarUrl} label={profile.displayName} />
                        <div>
                          <p className="metric-value social-display-name">{profile.displayName}</p>
                          <p className="muted">@{profile.username}</p>
                        </div>
                      </div>
                      <p className="muted social-bio-preview">
                        {profile.bio || 'Sin bio por ahora.'}
                      </p>
                      <p className="muted social-counter-text">
                        {profile.relationshipCounts.followers} seguidores ·{' '}
                        {profile.relationshipCounts.following} siguiendo ·{' '}
                        {profile.relationshipCounts.friends} amigos
                      </p>
                      <div className="actions social-actions-grid">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => navigate(`/social/${profile.username}`)}
                        >
                          Ver perfil
                        </button>
                        <button
                          className={isFollowing ? 'ghost-button' : 'primary-button'}
                          type="button"
                          onClick={() => void handleToggleFollow(profile)}
                          disabled={friendBusy}
                        >
                          {friendBusy
                            ? 'Guardando...'
                            : isFollowing
                              ? 'Siguiendo'
                              : 'Seguir'}
                        </button>
                        {friendStatus === 'none' ? (
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => void handleSendFriendRequest(profile.userId)}
                            disabled={friendBusy}
                          >
                            {friendBusy ? 'Guardando...' : 'Agregar amigo'}
                          </button>
                        ) : null}
                        {friendStatus === 'outgoing_pending' ? (
                          <button className="ghost-button" type="button" disabled>
                            Solicitud enviada
                          </button>
                        ) : null}
                        {friendStatus === 'incoming_pending' ? (
                          <>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() =>
                                void handleRespondFriendRequest(profile.userId, 'accepted')
                              }
                              disabled={friendBusy}
                            >
                              {friendBusy ? 'Guardando...' : 'Aceptar'}
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() =>
                                void handleRespondFriendRequest(profile.userId, 'rejected')
                              }
                              disabled={friendBusy}
                            >
                              Rechazar
                            </button>
                          </>
                        ) : null}
                        {friendStatus === 'friends' ? (
                          <span className="pill active">Amigos</span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'me' ? (
          <div className="stack">
            {loadingMine ? <p className="muted">Cargando tu perfil social...</p> : null}
            {!loadingMine && myProfile ? (
              <>
                <article className="social-summary-card">
                  <div className="social-profile-head">
                    <SocialAvatar
                      avatarUrl={myProfile.avatarUrl}
                      label={myProfile.displayName}
                      large
                    />
                    <div>
                      <p className="metric-value social-display-name">{myProfile.displayName}</p>
                      <p className="muted">@{myProfile.username}</p>
                      <div className="social-counter-row ig-style">
                        <button
                          type="button"
                          className="ghost-button social-counter-pill"
                          onClick={() => void openRelations('followers', myProfile.userId)}
                        >
                          <strong>{myRelationshipCounts.followers}</strong> seguidores
                        </button>
                        <button
                          type="button"
                          className="ghost-button social-counter-pill"
                          onClick={() => void openRelations('following', myProfile.userId)}
                        >
                          <strong>{myRelationshipCounts.following}</strong> siguiendo
                        </button>
                        <button
                          type="button"
                          className="ghost-button social-counter-pill"
                          onClick={() => void openRelations('friends', myProfile.userId)}
                        >
                          <strong>{myRelationshipCounts.friends}</strong> amigos
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="muted social-bio-preview">
                    {myProfile.bio || 'Aún no agregas bio.'}
                  </p>
                  <div className="actions">
                    <Link className="ghost-button" to="/settings">
                      Editar perfil
                    </Link>
                    <Link className="ghost-button" to={`/social/${myProfile.username}`}>
                      Ver perfil público
                    </Link>
                  </div>
                </article>

                <article className="social-summary-card">
                  <p className="metric-label">Publicar entrenamiento</p>
                  {!myWorkouts.length ? (
                    <p className="muted">No hay entrenamientos guardados para publicar.</p>
                  ) : (
                    <div className="stack">
                      <div className="field">
                        <label className="label" htmlFor="social-workout-select">
                          Entrenamiento
                        </label>
                        <select
                          id="social-workout-select"
                          value={selectedWorkoutId}
                          onChange={(event) => setSelectedWorkoutId(event.target.value)}
                        >
                          {myWorkouts.map((workout) => (
                            <option key={workout.id} value={workout.id}>
                              {workout.routineName} ·{' '}
                              {new Date(workout.endedAt).toLocaleDateString('es-CL')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="label" htmlFor="social-workout-caption">
                          Comentario (opcional)
                        </label>
                        <textarea
                          id="social-workout-caption"
                          rows={2}
                          value={newPostCaption}
                          onChange={(event) => setNewPostCaption(event.target.value)}
                          placeholder="Ej: Sesión sólida de push."
                        />
                      </div>
                      <div className="field">
                        <label className="label" htmlFor="social-workout-images">
                          Fotos (opcional)
                        </label>
                        <input
                          id="social-workout-images"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            setNewPostImages(Array.from(event.target.files ?? []).slice(0, 4))
                          }
                        />
                        {newPostImages.length ? (
                          <p className="muted">{newPostImages.length} foto(s) seleccionadas.</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handlePublishWorkout()}
                        disabled={publishing || !selectedWorkoutId}
                      >
                        {publishing ? 'Publicando...' : 'Publicar al feed'}
                      </button>
                    </div>
                  )}
                </article>

                <article className="social-summary-card">
                  <p className="metric-label">Solicitudes de amistad</p>
                  {!incomingFriendRequests.length ? (
                    <p className="muted">No tienes solicitudes pendientes.</p>
                  ) : (
                    <div className="stack social-request-list">
                      {incomingFriendRequests.map((request) => (
                        <article key={request.id} className="social-summary-card social-request-card">
                          <div className="social-profile-head">
                            <SocialAvatar
                              avatarUrl={request.requesterAvatarUrl}
                              label={request.requesterDisplayName}
                            />
                            <div>
                              <p className="metric-value social-display-name">
                                {request.requesterDisplayName}
                              </p>
                              <p className="muted">@{request.requesterUsername}</p>
                            </div>
                          </div>
                          <p className="muted">
                            Recibida el{' '}
                            {new Date(request.createdAt).toLocaleDateString('es-CL')}
                          </p>
                          <div className="actions social-actions-grid">
                            <button
                              type="button"
                              className="primary-button"
                              disabled={followBusyUserId === request.requesterUserId}
                              onClick={() =>
                                void handleRespondIncomingRequest(request, 'accepted')
                              }
                            >
                              Aceptar
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={followBusyUserId === request.requesterUserId}
                              onClick={() =>
                                void handleRespondIncomingRequest(request, 'rejected')
                              }
                            >
                              Rechazar
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>

                <article className="social-summary-card">
                  <p className="metric-label">Mis publicaciones</p>
                  {!myPosts.length ? (
                    <p className="muted">Aún no publicas entrenamientos.</p>
                  ) : (
                    <div className="stack social-post-list">
                      {myPosts.map((post) => (
                        <SocialPostCard
                          key={post.id}
                          post={post}
                          onLike={handleToggleLike}
                          onComment={openComments}
                          onProfile={(item) => navigate(`/social/${item.authorUsername}`)}
                          ownerActions={{
                            busy: postActionBusyId === post.id,
                            onToggleHidden: handleTogglePostHidden,
                            onDelete: handleDeletePost
                          }}
                        />
                      ))}
                    </div>
                  )}
                </article>

                <article className="social-summary-card">
                  <p className="metric-label">Rutinas públicas</p>
                  {!myRoutines.length ? (
                    <p className="muted">Aún no publicas rutinas.</p>
                  ) : (
                    <ul className="social-routine-compact-list">
                      {myRoutines.map((routine) => (
                        <li key={routine.id}>
                          <span>{routine.title}</span>
                          <span className="muted">
                            {new Date(routine.publishedAt).toLocaleDateString('es-CL')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {commentsPost ? (
        <div className="modal-overlay center" onClick={() => setCommentsPost(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="stack">
              <h2>Comentarios</h2>
              <p className="muted">{commentsPost.routineName ?? 'Entrenamiento'}</p>
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
                <label className="label" htmlFor="social-comment-input">
                  Nuevo comentario
                </label>
                <textarea
                  id="social-comment-input"
                  rows={2}
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Escribe un comentario..."
                />
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setCommentsPost(null)}
                >
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
