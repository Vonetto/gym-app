import { useState } from 'react';
import type { SocialWorkoutPost } from '../data/social';
import { SocialAvatar } from './SocialAvatar';

export function SocialPostCard({
  post,
  onLike,
  onComment,
  onProfile,
  ownerActions
}: {
  post: SocialWorkoutPost;
  onLike: (post: SocialWorkoutPost) => void;
  onComment: (post: SocialWorkoutPost) => void;
  onProfile?: (post: SocialWorkoutPost) => void;
  ownerActions?: {
    busy?: boolean;
    onToggleHidden: (post: SocialWorkoutPost) => void;
    onDelete: (post: SocialWorkoutPost) => void;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={post.hiddenAt ? 'social-post-card is-hidden' : 'social-post-card'}>
      <header className="social-post-header">
        {onProfile ? (
          <button type="button" className="social-user-link" onClick={() => onProfile(post)}>
            <SocialAvatar avatarUrl={post.authorAvatarUrl} label={post.authorDisplayName} />
            <span>
              <strong>{post.authorDisplayName}</strong>
              <span className="muted">@{post.authorUsername}</span>
            </span>
          </button>
        ) : (
          <div className="social-user-static">
            <SocialAvatar avatarUrl={post.authorAvatarUrl} label={post.authorDisplayName} />
            <span>
              <strong>{post.authorDisplayName}</strong>
              <span className="muted">@{post.authorUsername}</span>
            </span>
          </div>
        )}
        <time className="muted">
          {new Date(post.publishedAt).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short'
          })}
        </time>
      </header>

      <div className="social-post-body">
        <p className="social-post-title">{post.routineName ?? 'Entrenamiento'}</p>
        {post.hiddenAt ? <p className="muted">Publicación oculta.</p> : null}
        {post.caption ? <p className="social-post-caption">{post.caption}</p> : null}

        {post.imageUrls.length ? (
          <div className="social-post-gallery">
            {post.imageUrls.map((imageUrl, index) => (
              <img key={`${post.id}-${index}`} src={imageUrl} alt={`Publicación ${index + 1}`} />
            ))}
          </div>
        ) : null}

        <p className="muted social-post-summary-line">
          {post.summary.durationMinutes} min · {post.summary.setCount} sets · {post.summary.totalReps}{' '}
          reps · {post.summary.totalVolume} kg
        </p>

        <button
          type="button"
          className="social-post-expand-button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
        </button>

        {expanded ? (
          <>
            <div className="social-post-metrics">
              <span>{post.summary.durationMinutes} min</span>
              <span>{post.summary.setCount} sets</span>
              <span>{post.summary.totalReps} reps</span>
              <span>{post.summary.totalVolume} kg</span>
            </div>
            {post.summary.totalDistance > 0 ? (
              <p className="muted social-post-exercises">Distancia: {post.summary.totalDistance} m</p>
            ) : null}
            {post.summary.totalDurationSeconds > 0 ? (
              <p className="muted social-post-exercises">
                Tiempo acumulado: {post.summary.totalDurationSeconds} s
              </p>
            ) : null}
            {post.summary.topExercises.length ? (
              <p className="muted social-post-exercises">
                {post.summary.topExercises.join(' · ')}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <footer className="social-post-actions">
        {ownerActions ? (
          <>
            <button
              type="button"
              className="ghost-button"
              disabled={ownerActions.busy}
              onClick={() => ownerActions.onToggleHidden(post)}
            >
              {post.hiddenAt ? 'Mostrar' : 'Ocultar'}
            </button>
            <button
              type="button"
              className="ghost-button danger"
              disabled={ownerActions.busy}
              onClick={() => ownerActions.onDelete(post)}
            >
              Eliminar
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={post.likedByMe ? 'toggle active' : 'ghost-button'}
          onClick={() => onLike(post)}
        >
          Me gusta · {post.likeCount}
        </button>
        <button type="button" className="ghost-button" onClick={() => onComment(post)}>
          Comentarios · {post.commentCount}
        </button>
      </footer>
    </article>
  );
}
