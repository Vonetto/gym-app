import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { normalizeName } from './normalizeText';
import { exportRoutineBackup, importRoutineBackup, type RoutineBackupPayload } from './routineBackup';
import { listRoutines } from './routines';
import { getWorkoutById, getWorkoutExercises, getWorkoutSets } from './workouts';

export type ProfileVisibility = 'authenticated' | 'friends';
export type ScopedVisibility = 'authenticated' | 'friends' | 'private';

export interface SocialProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarPath?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialRelationshipCounts {
  followers: number;
  following: number;
  friends: number;
}

export interface SocialDirectoryProfile extends SocialProfile {
  isFollowing: boolean;
  relationshipCounts: SocialRelationshipCounts;
}

export type SocialFriendStatus = 'none' | 'incoming_pending' | 'outgoing_pending' | 'friends';

export interface SocialFriendConnection {
  id: string;
  userId: string;
  status: SocialFriendStatus;
  requesterUserId: string;
  addresseeUserId: string;
  updatedAt: string;
}

export interface SocialPrivacySettings {
  profileVisibility: ProfileVisibility;
  routinesVisibility: ScopedVisibility;
  recentHistoryVisibility: ScopedVisibility;
  prVisibility: ScopedVisibility;
  statsVisibility: ScopedVisibility;
  allowFollow: boolean;
  allowFriendRequests: boolean;
  updatedAt: string;
}

export interface SocialRoutine {
  id: string;
  ownerUserId: string;
  sourceRoutineId?: string;
  title: string;
  description?: string;
  tags: string[];
  authorUserId: string;
  authorUsername: string;
  authorDisplayName?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export type SocialPostVisibility = 'authenticated' | 'friends';

export interface SocialWorkoutPostSummary {
  durationMinutes: number;
  setCount: number;
  totalReps: number;
  totalVolume: number;
  totalDurationSeconds: number;
  totalDistance: number;
  topExercises: string[];
}

export interface SocialWorkoutPost {
  id: string;
  ownerUserId: string;
  workoutId?: string;
  routineId?: string;
  routineName?: string;
  caption?: string;
  visibility: SocialPostVisibility;
  tags: string[];
  summary: SocialWorkoutPostSummary;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  hiddenAt?: string;
  authorUserId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  imagePaths: string[];
  imageUrls: string[];
}

export interface SocialPostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

export interface SocialFriendRequest {
  id: string;
  requesterUserId: string;
  requesterUsername: string;
  requesterDisplayName: string;
  requesterAvatarUrl?: string;
  createdAt: string;
}

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};

type PrivacyRow = {
  user_id: string;
  profile_visibility: ProfileVisibility;
  routines_visibility: ScopedVisibility;
  recent_history_visibility: ScopedVisibility;
  pr_visibility: ScopedVisibility;
  stats_visibility: ScopedVisibility;
  allow_follow: boolean;
  allow_friend_requests: boolean;
  updated_at: string;
};

type SocialRoutineRow = {
  id: string;
  owner_user_id: string;
  source_routine_id?: string | null;
  title: string;
  description: string | null;
  tags: string[] | null;
  author_user_id: string;
  author_username: string;
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
  published_at: string;
  snapshot: unknown;
  custom_exercises: unknown;
};

type UserFollowRow = {
  follower_user_id: string;
  target_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SocialWorkoutPostRow = {
  id: string;
  owner_user_id: string;
  workout_id: string | null;
  routine_id: string | null;
  routine_name: string | null;
  caption: string | null;
  visibility: SocialPostVisibility;
  tags: string[] | null;
  summary: unknown;
  created_at: string;
  updated_at: string;
  published_at: string;
  hidden_at: string | null;
  deleted_at: string | null;
  image_paths: unknown;
};

type SocialPostLikeRow = {
  post_id: string;
  user_id: string;
  deleted_at: string | null;
};

type SocialPostCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type UserFriendshipRow = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  deleted_at: string | null;
};

const SOCIAL_ROUTINE_SELECT_WITH_SOURCE =
  'id, owner_user_id, source_routine_id, title, description, tags, author_user_id, author_username, author_display_name, created_at, updated_at, published_at, snapshot, custom_exercises';
const SOCIAL_ROUTINE_SELECT_NO_SOURCE =
  'id, owner_user_id, title, description, tags, author_user_id, author_username, author_display_name, created_at, updated_at, published_at, snapshot, custom_exercises';

export const DEFAULT_SOCIAL_PRIVACY: SocialPrivacySettings = {
  profileVisibility: 'authenticated',
  routinesVisibility: 'authenticated',
  recentHistoryVisibility: 'private',
  prVisibility: 'private',
  statsVisibility: 'authenticated',
  allowFollow: true,
  allowFriendRequests: true,
  updatedAt: new Date(0).toISOString()
};

function toSocialRoutine(row: SocialRoutineRow): SocialRoutine {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    sourceRoutineId: row.source_routine_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function parseImagePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function emptyRelationshipCounts(): SocialRelationshipCounts {
  return {
    followers: 0,
    following: 0,
    friends: 0
  };
}

function parseWorkoutSummary(value: unknown): SocialWorkoutPostSummary {
  if (!value || typeof value !== 'object') {
    return {
      durationMinutes: 0,
      setCount: 0,
      totalReps: 0,
      totalVolume: 0,
      totalDurationSeconds: 0,
      totalDistance: 0,
      topExercises: []
    };
  }

  const summary = value as Partial<SocialWorkoutPostSummary>;
  return {
    durationMinutes: Number(summary.durationMinutes) || 0,
    setCount: Number(summary.setCount) || 0,
    totalReps: Number(summary.totalReps) || 0,
    totalVolume: Number(summary.totalVolume) || 0,
    totalDurationSeconds: Number(summary.totalDurationSeconds) || 0,
    totalDistance: Number(summary.totalDistance) || 0,
    topExercises: Array.isArray(summary.topExercises)
      ? summary.topExercises.filter((item): item is string => typeof item === 'string')
      : []
  };
}

function ensureSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    return null;
  }
  return supabase;
}

function toProfile(row: ProfileRow, avatarUrl?: string): SocialProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name ?? row.username,
    bio: row.bio ?? '',
    avatarPath: row.avatar_path ?? undefined,
    avatarUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPrivacy(row: PrivacyRow): SocialPrivacySettings {
  return {
    profileVisibility: row.profile_visibility,
    routinesVisibility: row.routines_visibility,
    recentHistoryVisibility: row.recent_history_visibility,
    prVisibility: row.pr_visibility,
    statsVisibility: row.stats_visibility,
    allowFollow: row.allow_follow,
    allowFriendRequests: row.allow_friend_requests,
    updatedAt: row.updated_at
  };
}

function sanitizeUsername(value: string) {
  const normalized = normalizeName(value)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30);

  if (normalized.length >= 3) {
    return normalized;
  }

  return `user-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeUsernameLookup(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30);
}

function isMissingSourceRoutineIdColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
  const details = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return maybeError.code === '42703' || details.includes('source_routine_id');
}

function ensureUniqueRoutineName(baseName: string, existingNames: string[]) {
  const base = baseName.trim() || 'Rutina';
  const taken = new Set(existingNames.map((name) => normalizeName(name)));
  if (!taken.has(normalizeName(base))) {
    return base;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${base} (${suffix})`;
    if (!taken.has(normalizeName(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
  return `${base} (${crypto.randomUUID().slice(0, 4)})`;
}

function parseRoutineSnapshot(
  snapshot: unknown,
  customExercises: unknown
): RoutineBackupPayload | null {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const maybePayload = snapshot as Partial<RoutineBackupPayload>;
  if (maybePayload.routine && Array.isArray(maybePayload.exercises)) {
    return {
      version: 4,
      createdAt: maybePayload.createdAt ?? new Date().toISOString(),
      routine: maybePayload.routine,
      exercises: maybePayload.exercises
    };
  }

  const routineOnly = snapshot as RoutineBackupPayload['routine'];
  if (!routineOnly || typeof routineOnly !== 'object' || !('name' in routineOnly)) {
    return null;
  }

  return {
    version: 4,
    createdAt: new Date().toISOString(),
    routine: routineOnly,
    exercises: Array.isArray(customExercises)
      ? (customExercises as RoutineBackupPayload['exercises'])
      : []
  };
}

function deriveBaseUsername(user: User) {
  const metadataUsername =
    typeof user.user_metadata?.username === 'string'
      ? user.user_metadata.username
      : typeof user.user_metadata?.user_name === 'string'
        ? user.user_metadata.user_name
        : undefined;

  const emailPrefix = user.email?.split('@')[0];
  return sanitizeUsername(metadataUsername ?? emailPrefix ?? 'usuario');
}

function deriveDisplayName(user: User, username: string) {
  const displayName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : undefined;

  return displayName?.trim() || username;
}

async function buildUniqueUsername(baseUsername: string, currentUserId?: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    return baseUsername;
  }

  let attempt = 0;
  let candidate = sanitizeUsername(baseUsername);

  while (attempt < 50) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', candidate)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || data.user_id === currentUserId) {
      return candidate;
    }

    attempt += 1;
    candidate = sanitizeUsername(`${baseUsername}-${attempt + 1}`);
  }

  return sanitizeUsername(`${baseUsername}-${crypto.randomUUID().slice(0, 4)}`);
}

async function getSignedAvatarUrl(path?: string | null) {
  if (!path) return undefined;
  const supabase = ensureSupabase();
  if (!supabase) return undefined;

  const { data, error } = await supabase.storage.from('social-avatars').createSignedUrl(path, 3600);
  if (error) {
    throw error;
  }
  return data.signedUrl;
}

async function getSignedAvatarUrlSafe(path?: string | null) {
  try {
    return await getSignedAvatarUrl(path);
  } catch {
    return undefined;
  }
}

async function getSignedPostImageUrls(paths: string[]) {
  if (!paths.length) return [] as string[];
  const supabase = ensureSupabase();
  if (!supabase) return [] as string[];

  const signedUrls = await Promise.all(
    paths.map(async (path) => {
      try {
        const { data, error } = await supabase.storage
          .from('social-post-media')
          .createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) return undefined;
        return data.signedUrl;
      } catch {
        return undefined;
      }
    })
  );

  return signedUrls.filter((url): url is string => Boolean(url));
}

export async function ensureSocialProfile(user: User) {
  const supabase = ensureSupabase();
  if (!supabase) return null;

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  const now = new Date().toISOString();

  if (!existingProfile) {
    const username = sanitizeUsername(`${deriveBaseUsername(user)}-${user.id.slice(0, 6)}`);
    const displayName = deriveDisplayName(user, username);
    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: user.id,
      username,
      display_name: displayName,
      bio: '',
      avatar_path: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    if (insertError) {
      throw insertError;
    }
  }

  const { data: existingPrivacy, error: existingPrivacyError } = await supabase
    .from('profile_privacy_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingPrivacyError) {
    throw existingPrivacyError;
  }

  if (!existingPrivacy) {
    const { error: privacyInsertError } = await supabase.from('profile_privacy_settings').insert({
      user_id: user.id,
      profile_visibility: DEFAULT_SOCIAL_PRIVACY.profileVisibility,
      routines_visibility: DEFAULT_SOCIAL_PRIVACY.routinesVisibility,
      recent_history_visibility: DEFAULT_SOCIAL_PRIVACY.recentHistoryVisibility,
      pr_visibility: DEFAULT_SOCIAL_PRIVACY.prVisibility,
      stats_visibility: DEFAULT_SOCIAL_PRIVACY.statsVisibility,
      allow_follow: DEFAULT_SOCIAL_PRIVACY.allowFollow,
      allow_friend_requests: DEFAULT_SOCIAL_PRIVACY.allowFriendRequests,
      updated_at: now
    });

    if (privacyInsertError) {
      throw privacyInsertError;
    }
  }

  return getMySocialProfile(user.id);
}

export async function getMySocialProfile(userId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  const avatarUrl = await getSignedAvatarUrl(data.avatar_path);
  return toProfile(data as ProfileRow, avatarUrl);
}

export async function getSocialProfileByUsername(username: string) {
  const supabase = ensureSupabase();
  if (!supabase) return null;

  const cleanedUsername = normalizeUsernameLookup(username.replace(/^@+/, ''));
  if (!cleanedUsername) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .eq('username', cleanedUsername)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  const avatarUrl = await getSignedAvatarUrlSafe(data.avatar_path);
  return toProfile(data as ProfileRow, avatarUrl);
}

export async function listFollowingUserIds(userId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return new Set<string>();

  const { data, error } = await supabase
    .from('user_follows')
    .select('target_user_id')
    .eq('follower_user_id', userId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.target_user_id as string));
}

async function listProfileRowsByIds(userIds: string[]) {
  const supabase = ensureSupabase();
  if (!supabase || !userIds.length) return [] as ProfileRow[];

  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .in('user_id', userIds)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileRow[];
}

async function listRelationshipCountsByUsers(userIds: string[]) {
  const supabase = ensureSupabase();
  if (!supabase || !userIds.length) return new Map<string, SocialRelationshipCounts>();

  const uniqueUserIds = Array.from(new Set(userIds));
  const countsMap = new Map<string, SocialRelationshipCounts>();
  uniqueUserIds.forEach((userId) => countsMap.set(userId, emptyRelationshipCounts()));

  const [{ data: followerRows, error: followerError }, { data: followingRows, error: followingError }] =
    await Promise.all([
      (supabase as any)
        .from('user_follows')
        .select('follower_user_id, target_user_id')
        .in('target_user_id', uniqueUserIds)
        .is('deleted_at', null),
      (supabase as any)
        .from('user_follows')
        .select('follower_user_id, target_user_id')
        .in('follower_user_id', uniqueUserIds)
        .is('deleted_at', null)
    ]);

  if (followerError) throw followerError;
  if (followingError) throw followingError;

  ((followerRows ?? []) as UserFollowRow[]).forEach((row) => {
    const current = countsMap.get(row.target_user_id);
    if (current) {
      current.followers += 1;
    }
  });

  ((followingRows ?? []) as UserFollowRow[]).forEach((row) => {
    const current = countsMap.get(row.follower_user_id);
    if (current) {
      current.following += 1;
    }
  });

  const [friendshipA, friendshipB] = await Promise.all([
    (supabase as any)
      .from('user_friendships')
      .select('id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at')
      .in('requester_user_id', uniqueUserIds)
      .eq('status', 'accepted')
      .is('deleted_at', null),
    (supabase as any)
      .from('user_friendships')
      .select('id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at')
      .in('addressee_user_id', uniqueUserIds)
      .eq('status', 'accepted')
      .is('deleted_at', null)
  ]);

  if (friendshipA.error) throw friendshipA.error;
  if (friendshipB.error) throw friendshipB.error;

  const uniqueAccepted = new Map<string, UserFriendshipRow>();
  ([...(friendshipA.data ?? []), ...(friendshipB.data ?? [])] as UserFriendshipRow[]).forEach((row) => {
    uniqueAccepted.set(row.id, row);
  });

  uniqueAccepted.forEach((row) => {
    const requester = countsMap.get(row.requester_user_id);
    if (requester) requester.friends += 1;
    const addressee = countsMap.get(row.addressee_user_id);
    if (addressee) addressee.friends += 1;
  });

  return countsMap;
}

export async function getSocialRelationshipCounts(targetUserId: string) {
  const map = await listRelationshipCountsByUsers([targetUserId]);
  return map.get(targetUserId) ?? emptyRelationshipCounts();
}

export async function listSocialRelationMembers(
  relation: 'followers' | 'following' | 'friends',
  targetUserId: string
) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialProfile[];

  let userIds: string[] = [];
  if (relation === 'followers') {
    const { data, error } = await (supabase as any)
      .from('user_follows')
      .select('follower_user_id')
      .eq('target_user_id', targetUserId)
      .is('deleted_at', null);
    if (error) throw error;
    userIds = (data ?? []).map((row: { follower_user_id: string }) => row.follower_user_id);
  } else if (relation === 'following') {
    const { data, error } = await (supabase as any)
      .from('user_follows')
      .select('target_user_id')
      .eq('follower_user_id', targetUserId)
      .is('deleted_at', null);
    if (error) throw error;
    userIds = (data ?? []).map((row: { target_user_id: string }) => row.target_user_id);
  } else {
    const { data, error } = await (supabase as any)
      .from('user_friendships')
      .select('id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at')
      .or(`requester_user_id.eq.${targetUserId},addressee_user_id.eq.${targetUserId}`)
      .eq('status', 'accepted')
      .is('deleted_at', null);
    if (error) throw error;
    userIds = ((data ?? []) as UserFriendshipRow[]).map((row) =>
      row.requester_user_id === targetUserId ? row.addressee_user_id : row.requester_user_id
    );
  }

  const profileRows = await listProfileRowsByIds(userIds);
  const hydrated = await Promise.all(
    profileRows.map(async (row) => ({
      ...toProfile(row, await getSignedAvatarUrlSafe(row.avatar_path))
    }))
  );
  return hydrated.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
}

export async function listIncomingFriendRequests(currentUserId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialFriendRequest[];

  const { data, error } = await (supabase as any)
    .from('user_friendships')
    .select('id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at')
    .eq('addressee_user_id', currentUserId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as UserFriendshipRow[];
  if (!rows.length) return [] as SocialFriendRequest[];

  const requesterIds = rows.map((row) => row.requester_user_id);
  const profileRows = await listProfileRowsByIds(requesterIds);
  const profileMap = new Map<string, SocialProfile>();
  await Promise.all(
    profileRows.map(async (row) => {
      const avatarUrl = await getSignedAvatarUrlSafe(row.avatar_path);
      profileMap.set(row.user_id, toProfile(row, avatarUrl));
    })
  );

  return rows.map((row) => {
    const profile = profileMap.get(row.requester_user_id);
    return {
      id: row.id,
      requesterUserId: row.requester_user_id,
      requesterUsername: profile?.username ?? 'usuario',
      requesterDisplayName: profile?.displayName ?? 'Usuario',
      requesterAvatarUrl: profile?.avatarUrl,
      createdAt: row.created_at
    } satisfies SocialFriendRequest;
  });
}

function toFriendStatus(row: UserFriendshipRow, currentUserId: string): SocialFriendStatus {
  if (row.status === 'accepted') return 'friends';
  if (row.status === 'pending') {
    return row.requester_user_id === currentUserId
      ? 'outgoing_pending'
      : 'incoming_pending';
  }
  return 'none';
}

export async function listFriendConnections(userId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialFriendConnection[];

  const { data, error } = await (supabase as any)
    .from('user_friendships')
    .select(
      'id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at'
    )
    .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as UserFriendshipRow[];
  return rows
    .filter((row) => row.status === 'pending' || row.status === 'accepted')
    .map((row) => ({
      id: row.id,
      userId: row.requester_user_id === userId ? row.addressee_user_id : row.requester_user_id,
      status: toFriendStatus(row, userId),
      requesterUserId: row.requester_user_id,
      addresseeUserId: row.addressee_user_id,
      updatedAt: row.updated_at
    }));
}

export async function listFriendUserIds(userId: string) {
  const connections = await listFriendConnections(userId);
  return new Set(
    connections.filter((connection) => connection.status === 'friends').map((connection) => connection.userId)
  );
}

export async function sendFriendRequest(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) return;
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('user_friendships')
    .select(
      'id, requester_user_id, addressee_user_id, status, created_at, updated_at, responded_at, deleted_at'
    )
    .or(
      `and(requester_user_id.eq.${currentUserId},addressee_user_id.eq.${targetUserId}),and(requester_user_id.eq.${targetUserId},addressee_user_id.eq.${currentUserId})`
    )
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const existing = ((data ?? []) as UserFriendshipRow[])[0];
  if (!existing) {
    const { error: insertError } = await (supabase as any).from('user_friendships').insert({
      id: `friendship-${crypto.randomUUID()}`,
      requester_user_id: currentUserId,
      addressee_user_id: targetUserId,
      status: 'pending',
      created_at: now,
      updated_at: now,
      responded_at: null,
      deleted_at: null
    });
    if (insertError) {
      throw insertError;
    }
    return;
  }

  if (!existing.deleted_at) {
    if (existing.status === 'accepted') return;
    if (
      existing.status === 'pending' &&
      existing.requester_user_id === targetUserId &&
      existing.addressee_user_id === currentUserId
    ) {
      // Already received request; keep state for explicit accept.
      return;
    }
    if (
      existing.status === 'pending' &&
      existing.requester_user_id === currentUserId &&
      existing.addressee_user_id === targetUserId
    ) {
      return;
    }
  }

  const { error: updateError } = await (supabase as any)
    .from('user_friendships')
    .update({
      requester_user_id: currentUserId,
      addressee_user_id: targetUserId,
      status: 'pending',
      updated_at: now,
      responded_at: null,
      deleted_at: null
    })
    .eq('id', existing.id);

  if (updateError) {
    throw updateError;
  }
}

export async function respondFriendRequest(
  currentUserId: string,
  friendshipId: string,
  decision: 'accepted' | 'rejected'
) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('user_friendships')
    .update({
      status: decision,
      responded_at: now,
      updated_at: now
    })
    .eq('id', friendshipId)
    .eq('addressee_user_id', currentUserId)
    .eq('status', 'pending')
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}

export async function listSocialProfiles(currentUserId: string, search = '') {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialDirectoryProfile[];

  const cleanedSearch = search.trim().replace(/^@+/, '');
  let query: any = (supabase as any)
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .is('deleted_at', null)
    .neq('user_id', currentUserId)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (cleanedSearch) {
    query = query.or(`username.ilike.%${cleanedSearch}%,display_name.ilike.%${cleanedSearch}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const followingIds = await listFollowingUserIds(currentUserId);
  const rows = (data ?? []) as ProfileRow[];
  const countsMap = await listRelationshipCountsByUsers(rows.map((row) => row.user_id));
  const profiles = await Promise.all(
    rows.map(async (row) => {
      const avatarUrl = await getSignedAvatarUrlSafe(row.avatar_path);
      return {
        ...toProfile(row, avatarUrl),
        isFollowing: followingIds.has(row.user_id),
        relationshipCounts: countsMap.get(row.user_id) ?? emptyRelationshipCounts()
      };
    })
  );

  return profiles;
}

export async function followSocialProfile(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) return;
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from('user_follows')
    .select('follower_user_id, target_user_id, created_at, updated_at, deleted_at')
    .eq('follower_user_id', currentUserId)
    .eq('target_user_id', targetUserId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingRow = existing as UserFollowRow | null;
  if (existingRow) {
    if (!existingRow.deleted_at) {
      return;
    }

    const { error: restoreError } = await supabase
      .from('user_follows')
      .update({
        deleted_at: null,
        updated_at: now
      })
      .eq('follower_user_id', currentUserId)
      .eq('target_user_id', targetUserId);

    if (restoreError) {
      throw restoreError;
    }
    return;
  }

  const { error: insertError } = await supabase.from('user_follows').insert({
    follower_user_id: currentUserId,
    target_user_id: targetUserId,
    created_at: now,
    updated_at: now,
    deleted_at: null
  });

  if (insertError) {
    throw insertError;
  }
}

export async function unfollowSocialProfile(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) return;
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_follows')
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq('follower_user_id', currentUserId)
    .eq('target_user_id', targetUserId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}

export async function getMyPrivacySettings(userId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return DEFAULT_SOCIAL_PRIVACY;

  const { data, error } = await supabase
    .from('profile_privacy_settings')
    .select(
      'user_id, profile_visibility, routines_visibility, recent_history_visibility, pr_visibility, stats_visibility, allow_follow, allow_friend_requests, updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return DEFAULT_SOCIAL_PRIVACY;
  }

  return toPrivacy(data as PrivacyRow);
}

export async function updateMySocialProfile(
  userId: string,
  patch: {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarPath?: string | null;
  }
) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const next: Record<string, string | null> = {
    updated_at: new Date().toISOString()
  } as Record<string, string | null>;

  if (patch.username !== undefined) {
    const username = sanitizeUsername(patch.username);
    next.username = await buildUniqueUsername(username, userId);
  }
  if (patch.displayName !== undefined) {
    next.display_name = patch.displayName.trim() || null;
  }
  if (patch.bio !== undefined) {
    next.bio = patch.bio.trim() || null;
  }
  if (patch.avatarPath !== undefined) {
    next.avatar_path = patch.avatarPath;
  }

  const { error } = await supabase
    .from('profiles')
    .update(next)
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  return getMySocialProfile(userId);
}

export async function updateMyPrivacySettings(
  userId: string,
  patch: Partial<{
    profileVisibility: ProfileVisibility;
    routinesVisibility: ScopedVisibility;
    recentHistoryVisibility: ScopedVisibility;
    prVisibility: ScopedVisibility;
    statsVisibility: ScopedVisibility;
    allowFollow: boolean;
    allowFriendRequests: boolean;
  }>
) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const payload = {
    updated_at: now,
    ...(patch.profileVisibility ? { profile_visibility: patch.profileVisibility } : {}),
    ...(patch.routinesVisibility ? { routines_visibility: patch.routinesVisibility } : {}),
    ...(patch.recentHistoryVisibility
      ? { recent_history_visibility: patch.recentHistoryVisibility }
      : {}),
    ...(patch.prVisibility ? { pr_visibility: patch.prVisibility } : {}),
    ...(patch.statsVisibility ? { stats_visibility: patch.statsVisibility } : {}),
    ...(patch.allowFollow !== undefined ? { allow_follow: patch.allowFollow } : {}),
    ...(patch.allowFriendRequests !== undefined
      ? { allow_friend_requests: patch.allowFriendRequests }
      : {})
  };

  const { error } = await supabase
    .from('profile_privacy_settings')
    .update(payload)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return getMyPrivacySettings(userId);
}

export async function uploadMyAvatar(userId: string, file: File, previousPath?: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from('social-avatars').upload(path, file, {
    upsert: false,
    cacheControl: '3600'
  });

  if (error) {
    throw error;
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from('social-avatars').remove([previousPath]);
  }

  return path;
}

export async function removeMyAvatar(userId: string, avatarPath?: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  if (avatarPath) {
    await supabase.storage.from('social-avatars').remove([avatarPath]);
  }

  return updateMySocialProfile(userId, { avatarPath: null });
}

async function buildLocalWorkoutPostPayload(workoutId: string) {
  const workout = await getWorkoutById(workoutId);
  if (!workout) {
    throw new Error('workout-not-found');
  }

  const workoutExercises = await getWorkoutExercises(workoutId);
  let setCount = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let totalDurationSeconds = 0;
  let totalDistance = 0;

  for (const workoutExercise of workoutExercises) {
    const sets = await getWorkoutSets(workoutExercise.id);
    setCount += sets.length;
    for (const set of sets) {
      const reps = Number(set.reps ?? 0);
      const weight = Number(set.weight ?? 0);
      const duration = Number(set.duration ?? 0);
      const distance = Number(set.distance ?? 0);
      totalReps += reps;
      totalDurationSeconds += duration;
      totalDistance += distance;
      if (weight > 0 && reps > 0) {
        totalVolume += weight * reps;
      }
    }
  }

  const durationMs =
    new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime();
  const durationMinutes = Number.isFinite(durationMs)
    ? Math.max(0, Math.round(durationMs / (1000 * 60)))
    : 0;

  const topExercises = workoutExercises
    .map((entry) => entry.name)
    .filter((name, index, list) => Boolean(name) && list.indexOf(name) === index)
    .slice(0, 4);

  return {
    workout,
    routineName: workout.routineName ?? 'Entreno',
    tags: workout.tags ?? [],
    summary: {
      durationMinutes,
      setCount,
      totalReps,
      totalVolume,
      totalDurationSeconds,
      totalDistance,
      topExercises
    } satisfies SocialWorkoutPostSummary
  };
}

async function hydrateSocialPosts(
  currentUserId: string,
  rows: SocialWorkoutPostRow[]
) {
  if (!rows.length) return [] as SocialWorkoutPost[];

  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialWorkoutPost[];

  const ownerIds = Array.from(new Set(rows.map((row) => row.owner_user_id)));
  const postIds = rows.map((row) => row.id);

  const [{ data: profileRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    (supabase as any)
      .from('profiles')
      .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
      .in('user_id', ownerIds)
      .is('deleted_at', null),
    (supabase as any)
      .from('social_post_likes')
      .select('post_id, user_id, deleted_at')
      .in('post_id', postIds)
      .is('deleted_at', null),
    (supabase as any)
      .from('social_post_comments')
      .select('id, post_id, user_id, content, created_at, updated_at, deleted_at')
      .in('post_id', postIds)
      .is('deleted_at', null)
  ]);

  const profiles = (profileRows ?? []) as ProfileRow[];
  const profileMap = new Map<string, SocialProfile>();
  await Promise.all(
    profiles.map(async (row) => {
      const avatarUrl = await getSignedAvatarUrlSafe(row.avatar_path);
      profileMap.set(row.user_id, toProfile(row, avatarUrl));
    })
  );

  const likes = (likeRows ?? []) as SocialPostLikeRow[];
  const comments = (commentRows ?? []) as SocialPostCommentRow[];

  const likeCountByPost = new Map<string, number>();
  const commentCountByPost = new Map<string, number>();
  const likedByMe = new Set<string>();

  likes.forEach((row) => {
    likeCountByPost.set(row.post_id, (likeCountByPost.get(row.post_id) ?? 0) + 1);
    if (row.user_id === currentUserId) {
      likedByMe.add(row.post_id);
    }
  });

  comments.forEach((row) => {
    commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1);
  });

  return Promise.all(
    rows.map(async (row) => {
      const profile = profileMap.get(row.owner_user_id);
      const imagePaths = parseImagePaths(row.image_paths);
      const imageUrls = await getSignedPostImageUrls(imagePaths);
      return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        workoutId: row.workout_id ?? undefined,
        routineId: row.routine_id ?? undefined,
        routineName: row.routine_name ?? undefined,
        caption: row.caption ?? undefined,
        visibility: row.visibility,
        tags: sanitizeTags(row.tags),
        summary: parseWorkoutSummary(row.summary),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        hiddenAt: row.hidden_at ?? undefined,
        authorUserId: row.owner_user_id,
        authorUsername: profile?.username ?? 'usuario',
        authorDisplayName: profile?.displayName ?? 'Usuario',
        authorAvatarUrl: profile?.avatarUrl,
        likeCount: likeCountByPost.get(row.id) ?? 0,
        commentCount: commentCountByPost.get(row.id) ?? 0,
        likedByMe: likedByMe.has(row.id),
        imagePaths,
        imageUrls
      } satisfies SocialWorkoutPost;
    })
  );
}

async function replaceSocialPostImages(
  userId: string,
  postId: string,
  newFiles: File[],
  previousPaths: string[]
) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  if (!newFiles.length) {
    if (previousPaths.length) {
      await supabase.storage.from('social-post-media').remove(previousPaths);
    }
    return [] as string[];
  }

  const uploadedPaths: string[] = [];
  try {
    for (let index = 0; index < newFiles.length; index += 1) {
      const file = newFiles[index];
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const nextPath = `${postId}/${userId}-${Date.now()}-${index}.${extension}`;
      const { error } = await supabase.storage.from('social-post-media').upload(nextPath, file, {
        upsert: false,
        cacheControl: '3600'
      });
      if (error) throw error;
      uploadedPaths.push(nextPath);
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from('social-post-media').remove(uploadedPaths);
    }
    throw error;
  }

  if (previousPaths.length) {
    await supabase.storage.from('social-post-media').remove(previousPaths);
  }

  return uploadedPaths;
}

export async function publishWorkoutPostToSocial(
  userId: string,
  workoutId: string,
  options?: {
    caption?: string;
    visibility?: SocialPostVisibility;
    imageFiles?: File[];
  }
) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const [{ workout, routineName, tags, summary }, profile] = await Promise.all([
    buildLocalWorkoutPostPayload(workoutId),
    getMySocialProfile(userId)
  ]);

  if (!profile) {
    throw new Error('social-profile-not-found');
  }

  const now = new Date().toISOString();
  const payload = {
    owner_user_id: userId,
    workout_id: workout.id,
    routine_id: workout.routineId ?? null,
    routine_name: routineName,
    caption: options?.caption?.trim() || null,
    visibility: options?.visibility ?? 'authenticated',
    tags,
    summary,
    image_paths: [] as string[],
    updated_at: now,
    published_at: now
  };

  const { data: existing, error: existingError } = await (supabase as any)
    .from('social_workout_posts')
    .select('id, image_paths')
    .eq('owner_user_id', userId)
    .eq('workout_id', workout.id)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let imagePaths = parseImagePaths(existing?.image_paths);
  if (existing?.id && options?.imageFiles !== undefined) {
    imagePaths = await replaceSocialPostImages(userId, existing.id as string, options.imageFiles, imagePaths);
  }

  if (existing?.id) {
    const { error: updateError } = await (supabase as any)
      .from('social_workout_posts')
      .update({
        ...payload,
        image_paths: imagePaths
      })
      .eq('id', existing.id)
      .eq('owner_user_id', userId)
      .is('deleted_at', null);

    if (updateError) {
      throw updateError;
    }
    return existing.id as string;
  }

  const postId = `social-post-${crypto.randomUUID()}`;
  const { error: insertError } = await (supabase as any).from('social_workout_posts').insert({
    id: postId,
    ...payload,
    image_paths: [],
    created_at: now,
    deleted_at: null
  });

  if (insertError) {
    throw insertError;
  }

  if (options?.imageFiles !== undefined) {
    const nextImagePaths = await replaceSocialPostImages(userId, postId, options.imageFiles, []);
    const { error: updateError } = await (supabase as any)
      .from('social_workout_posts')
      .update({
        image_paths: nextImagePaths,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .eq('owner_user_id', userId)
      .is('deleted_at', null);
    if (updateError) {
      throw updateError;
    }
  }

  return postId;
}

export async function listSocialWorkoutPosts(
  currentUserId: string,
  options?: {
    mode?: 'for_you' | 'following' | 'friends';
    search?: string;
    ownerUserId?: string;
    limit?: number;
    includeHidden?: boolean;
  }
) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialWorkoutPost[];

  const mode = options?.mode ?? 'for_you';
  const search = options?.search?.trim() ?? '';
  const limit = options?.limit ?? 60;

  let query: any = (supabase as any)
    .from('social_workout_posts')
    .select(
      'id, owner_user_id, workout_id, routine_id, routine_name, caption, visibility, tags, summary, image_paths, created_at, updated_at, published_at, hidden_at, deleted_at'
    )
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (options?.ownerUserId) {
    query = query.eq('owner_user_id', options.ownerUserId);
    if (!(options.ownerUserId === currentUserId && options.includeHidden)) {
      query = query.is('hidden_at', null);
    }
  } else if (mode === 'following' || mode === 'friends') {
    const ids =
      mode === 'following'
        ? Array.from(await listFollowingUserIds(currentUserId))
        : Array.from(await listFriendUserIds(currentUserId));
    if (!ids.length) return [] as SocialWorkoutPost[];
    query = query.in('owner_user_id', ids);
  }

  if (!options?.ownerUserId) {
    query = query.is('hidden_at', null);
  }

  if (search) {
    query = query.or(`routine_name.ilike.%${search}%,caption.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return hydrateSocialPosts(currentUserId, (data ?? []) as SocialWorkoutPostRow[]);
}

export async function toggleLikeOnSocialPost(userId: string, postId: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await (supabase as any)
    .from('social_post_likes')
    .select('post_id, user_id, deleted_at')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const row = existing as SocialPostLikeRow | null;
  if (!row) {
    const { error: insertError } = await (supabase as any).from('social_post_likes').insert({
      post_id: postId,
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });
    if (insertError) {
      throw insertError;
    }
    return true;
  }

  if (row.deleted_at) {
    const { error: restoreError } = await (supabase as any)
      .from('social_post_likes')
      .update({
        deleted_at: null,
        updated_at: now
      })
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (restoreError) {
      throw restoreError;
    }
    return true;
  }

  const { error: unlikeError } = await (supabase as any)
    .from('social_post_likes')
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq('post_id', postId)
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (unlikeError) {
    throw unlikeError;
  }
  return false;
}

export async function setSocialPostHidden(userId: string, postId: string, hidden: boolean) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('social_workout_posts')
    .update({
      hidden_at: hidden ? now : null,
      updated_at: now
    })
    .eq('id', postId)
    .eq('owner_user_id', userId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}

export async function deleteSocialPost(userId: string, postId: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const { data: postData, error: fetchError } = await (supabase as any)
    .from('social_workout_posts')
    .select('image_paths')
    .eq('id', postId)
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const imagePaths = parseImagePaths(postData?.image_paths);
  if (imagePaths.length) {
    await supabase.storage.from('social-post-media').remove(imagePaths);
  }

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('social_workout_posts')
    .update({
      deleted_at: now,
      hidden_at: null,
      updated_at: now
    })
    .eq('id', postId)
    .eq('owner_user_id', userId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}

export async function listSocialPostComments(postId: string) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialPostComment[];

  const { data, error } = await (supabase as any)
    .from('social_post_comments')
    .select('id, post_id, user_id, content, created_at, updated_at, deleted_at')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SocialPostCommentRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));

  const { data: profileRows, error: profilesError } = await (supabase as any)
    .from('profiles')
    .select('user_id, username, display_name, bio, avatar_path, created_at, updated_at')
    .in('user_id', userIds)
    .is('deleted_at', null);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map<string, SocialProfile>();
  const profiles = (profileRows ?? []) as ProfileRow[];
  await Promise.all(
    profiles.map(async (row) => {
      const avatarUrl = await getSignedAvatarUrlSafe(row.avatar_path);
      profileMap.set(row.user_id, toProfile(row, avatarUrl));
    })
  );

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      username: profile?.username ?? 'usuario',
      displayName: profile?.displayName ?? 'Usuario',
      avatarUrl: profile?.avatarUrl,
      content: row.content,
      createdAt: row.created_at
    } satisfies SocialPostComment;
  });
}

export async function addSocialPostComment(userId: string, postId: string, content: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('empty-comment');
  }

  const now = new Date().toISOString();
  const commentId = `social-comment-${crypto.randomUUID()}`;
  const { error } = await (supabase as any).from('social_post_comments').insert({
    id: commentId,
    post_id: postId,
    user_id: userId,
    content: trimmed,
    created_at: now,
    updated_at: now,
    deleted_at: null
  });

  if (error) {
    throw error;
  }

  return commentId;
}

export async function publishRoutineToSocial(userId: string, routineId: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const [profile, backupPayload] = await Promise.all([
    getMySocialProfile(userId),
    exportRoutineBackup(routineId)
  ]);
  if (!profile) {
    throw new Error('social-profile-not-found');
  }

  const now = new Date().toISOString();
  const basePayload: RoutineBackupPayload = {
    ...backupPayload,
    version: 4
  };

  let hasSourceRoutineIdColumn = true;
  let existing:
    | {
        id: string;
      }
    | null = null;

  const { data: existingBySource, error: existingBySourceError } = await supabase
    .from('social_routines')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('source_routine_id', routineId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingBySourceError) {
    if (!isMissingSourceRoutineIdColumn(existingBySourceError)) {
      throw existingBySourceError;
    }
    hasSourceRoutineIdColumn = false;
  } else {
    existing = existingBySource;
  }

  if (!hasSourceRoutineIdColumn) {
    const { data: fallbackExisting, error: fallbackExistingError } = await supabase
      .from('social_routines')
      .select('id')
      .eq('owner_user_id', userId)
      .eq('title', basePayload.routine.name)
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackExistingError) {
      throw fallbackExistingError;
    }
    existing = fallbackExisting;
  }

  if (existing?.id) {
    const updatePayload = {
      title: basePayload.routine.name,
      description: `Rutina compartida por ${profile.displayName}`,
      tags: basePayload.routine.tags,
      snapshot: basePayload,
      custom_exercises: basePayload.exercises,
      author_user_id: userId,
      author_username: profile.username,
      author_display_name: profile.displayName,
      updated_at: now,
      published_at: now,
      ...(hasSourceRoutineIdColumn ? { source_routine_id: routineId } : {})
    };

    const { error: updateError } = await supabase
      .from('social_routines')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('owner_user_id', userId)
      .is('deleted_at', null);

    if (updateError) {
      throw updateError;
    }

    return existing.id;
  }

  const socialId = `social-routine-${crypto.randomUUID()}`;
  const insertPayload = {
    id: socialId,
    owner_user_id: userId,
    title: basePayload.routine.name,
    description: `Rutina compartida por ${profile.displayName}`,
    tags: basePayload.routine.tags,
    snapshot: basePayload,
    custom_exercises: basePayload.exercises,
    author_user_id: userId,
    author_username: profile.username,
    author_display_name: profile.displayName,
    created_at: now,
    updated_at: now,
    published_at: now,
    deleted_at: null,
    ...(hasSourceRoutineIdColumn ? { source_routine_id: routineId } : {})
  };

  const { error: insertError } = await supabase.from('social_routines').insert(insertPayload);

  if (insertError) {
    if (hasSourceRoutineIdColumn && isMissingSourceRoutineIdColumn(insertError)) {
      const { source_routine_id: _ignoredSourceRoutineId, ...insertPayloadWithoutSource } =
        insertPayload;
      const { error: fallbackInsertError } = await supabase
        .from('social_routines')
        .insert(insertPayloadWithoutSource);
      if (fallbackInsertError) {
        throw fallbackInsertError;
      }
      return socialId;
    }
    throw insertError;
  }

  return socialId;
}

export async function listSocialRoutines(search = '') {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialRoutine[];

  const cleanedSearch = search.trim();
  const runQuery = async (includeSourceRoutineId: boolean) => {
    const selectColumns = includeSourceRoutineId
      ? SOCIAL_ROUTINE_SELECT_WITH_SOURCE
      : SOCIAL_ROUTINE_SELECT_NO_SOURCE;
    let query: any = (supabase as any).from('social_routines').select(selectColumns);
    query = query.is('deleted_at', null).order('published_at', { ascending: false }).limit(80);

    if (cleanedSearch) {
      query = query.ilike('title', `%${cleanedSearch}%`);
    }

    return query;
  };

  let { data, error } = await runQuery(true);
  if (error && isMissingSourceRoutineIdColumn(error)) {
    ({ data, error } = await runQuery(false));
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: SocialRoutineRow) => toSocialRoutine(row));
}

export async function listSocialRoutinesByOwner(ownerUserId: string, limit = 20) {
  const supabase = ensureSupabase();
  if (!supabase) return [] as SocialRoutine[];

  const runQuery = (includeSourceRoutineId: boolean) => {
    const selectColumns = includeSourceRoutineId
      ? SOCIAL_ROUTINE_SELECT_WITH_SOURCE
      : SOCIAL_ROUTINE_SELECT_NO_SOURCE;
    let query: any = (supabase as any).from('social_routines').select(selectColumns);
    query = query
      .eq('owner_user_id', ownerUserId)
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(limit);
    return query;
  };

  let { data, error } = await runQuery(true);
  if (error && isMissingSourceRoutineIdColumn(error)) {
    ({ data, error } = await runQuery(false));
  }
  if (error) {
    throw error;
  }

  return (data ?? []).map((row: SocialRoutineRow) => toSocialRoutine(row));
}

export async function copySocialRoutineToLocal(socialRoutineId: string) {
  const supabase = ensureSupabase();
  if (!supabase) {
    throw new Error('supabase-unavailable');
  }

  const runQuery = (includeSourceRoutineId: boolean) => {
    const selectColumns = includeSourceRoutineId
      ? SOCIAL_ROUTINE_SELECT_WITH_SOURCE
      : SOCIAL_ROUTINE_SELECT_NO_SOURCE;
    let query: any = (supabase as any).from('social_routines').select(selectColumns);
    query = query.eq('id', socialRoutineId).is('deleted_at', null).maybeSingle();
    return query;
  };

  let { data, error } = await runQuery(true);
  if (error && isMissingSourceRoutineIdColumn(error)) {
    ({ data, error } = await runQuery(false));
  }

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('social-routine-not-found');
  }

  const row = data as SocialRoutineRow;
  const payload = parseRoutineSnapshot(row.snapshot, row.custom_exercises);
  if (!payload) {
    throw new Error('social-routine-invalid-payload');
  }

  const localRoutines = await listRoutines();
  const uniqueName = ensureUniqueRoutineName(
    payload.routine.name,
    localRoutines.map((routine) => routine.name)
  );

  const routineId = await importRoutineBackup({
    ...payload,
    routine: {
      ...payload.routine,
      name: uniqueName
    }
  });

  return {
    routineId,
    importedName: uniqueName,
    socialRoutine: toSocialRoutine(row)
  };
}
