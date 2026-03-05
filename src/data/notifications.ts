import { getSupabaseClient } from './supabase';

export interface NotificationCapability {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isStandalone: boolean;
  isAppleMobile: boolean;
  requiresStandaloneForPush: boolean;
  pushSupported: boolean;
}

export interface AppNotificationPayload {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: Record<string, unknown>;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  const navigatorStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return navigatorStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function isAppleMobileBrowser() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  const touchMac =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(userAgent) || touchMac;
}

export function getNotificationCapability(): NotificationCapability {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      permission: 'unsupported',
      hasServiceWorker: false,
      hasPushManager: false,
      isStandalone: false,
      isAppleMobile: false,
      requiresStandaloneForPush: false,
      pushSupported: false
    };
  }

  const supported = 'Notification' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const isStandalone = isStandalonePwa();
  const isAppleMobile = isAppleMobileBrowser();
  const requiresStandaloneForPush = isAppleMobile;

  return {
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    hasServiceWorker,
    hasPushManager,
    isStandalone,
    isAppleMobile,
    requiresStandaloneForPush,
    pushSupported:
      supported && hasServiceWorker && hasPushManager && (!requiresStandaloneForPush || isStandalone)
  };
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported' as const;
  }
  return Notification.requestPermission();
}

export async function showAppNotification(payload: AppNotificationPayload) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const data = {
    url: payload.url,
    ...(payload.data ?? {})
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
        data
      });
      return true;
    } catch {
      // Fallback below.
    }
  }

  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data
    });
    return true;
  } catch {
    return false;
  }
}

export function getNotificationStatusLabel(capability: NotificationCapability) {
  if (!capability.supported) return 'No soportado';
  if (capability.requiresStandaloneForPush && !capability.isStandalone) return 'Instala la app';
  if (capability.permission === 'denied') return 'Bloqueado';
  if (capability.permission === 'granted') return 'Permitido';
  return 'Pendiente';
}

export function hasPushPublicKey() {
  return Boolean(import.meta.env.VITE_PUSH_PUBLIC_KEY);
}

function decodeBase64Url(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function getCurrentPushSubscription() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeDeviceToPush(userId: string) {
  const supabase = getSupabaseClient();
  const vapidPublicKey = import.meta.env.VITE_PUSH_PUBLIC_KEY;
  if (!supabase || !vapidPublicKey) {
    throw new Error('push-config-missing');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(vapidPublicKey)
    });
  }

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    id: subscription.endpoint,
    endpoint: subscription.endpoint,
    subscription_json: subscription.toJSON(),
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  const { error } = await supabase.from('user_push_subscriptions').upsert([row], {
    onConflict: 'user_id,id'
  });
  if (error) throw error;

  return subscription;
}

export async function unsubscribeDeviceFromPush(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('push-config-missing');
  }

  const subscription = await getCurrentPushSubscription();
  if (!subscription) return false;

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    id: subscription.endpoint,
    endpoint: subscription.endpoint,
    subscription_json: subscription.toJSON(),
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    created_at: now,
    updated_at: now,
    deleted_at: now
  };

  const { error } = await supabase.from('user_push_subscriptions').upsert([row], {
    onConflict: 'user_id,id'
  });
  if (error) throw error;

  await subscription.unsubscribe();
  return true;
}
