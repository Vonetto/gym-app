import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationStatusLabel,
  showAppNotification,
  type NotificationCapability
} from './notifications';

class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();

  constructor(_title: string, _options?: NotificationOptions) {}
}

function setNotificationPermission(permission: NotificationPermission) {
  MockNotification.permission = permission;
  Object.defineProperty(globalThis, 'Notification', {
    value: MockNotification,
    configurable: true
  });
}

describe('notifications', () => {
  const originalNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNotification) {
      Object.defineProperty(globalThis, 'Notification', originalNotification);
    } else {
      // @ts-expect-error cleanup for test-only injected property
      delete globalThis.Notification;
    }
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      // @ts-expect-error cleanup for test-only injected property
      delete navigator.serviceWorker;
    }
  });

  it('returns false when permission is not granted', async () => {
    setNotificationPermission('denied');

    const notified = await showAppNotification({
      title: 'Descanso terminado'
    });

    expect(notified).toBe(false);
  });

  it('uses service worker registration when available', async () => {
    setNotificationPermission('granted');
    const showNotification = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ showNotification }) },
      configurable: true
    });

    const notified = await showAppNotification({
      title: 'Descanso terminado',
      body: 'Vuelve a la siguiente serie',
      tag: 'rest-finished'
    });

    expect(notified).toBe(true);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      'Descanso terminado',
      expect.objectContaining({
        body: 'Vuelve a la siguiente serie',
        tag: 'rest-finished'
      })
    );
  });

  it('maps capability states to user label', () => {
    const blocked: NotificationCapability = {
      supported: true,
      permission: 'denied',
      hasServiceWorker: true,
      hasPushManager: true,
      isStandalone: true,
      isAppleMobile: false,
      requiresStandaloneForPush: false,
      pushSupported: true
    };
    const installNeeded: NotificationCapability = {
      ...blocked,
      permission: 'default',
      isAppleMobile: true,
      requiresStandaloneForPush: true,
      isStandalone: false,
      pushSupported: false
    };
    const granted: NotificationCapability = {
      ...blocked,
      permission: 'granted'
    };

    expect(getNotificationStatusLabel(installNeeded)).toBe('Instala la app');
    expect(getNotificationStatusLabel(blocked)).toBe('Bloqueado');
    expect(getNotificationStatusLabel(granted)).toBe('Permitido');
  });
});
