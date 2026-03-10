export function SocialAvatar({
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
        large
          ? 'social-avatar social-avatar-large social-avatar-fallback'
          : 'social-avatar social-avatar-fallback'
      }
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}
