export type PublicAppLink = { kind: 'invite' | 'register'; token: string };

/** Only accept our public link routes; never let a link select an API server. */
export function publicAppLink(
  value: string | null | undefined,
): PublicAppLink | null {
  if (!value || value.length > 2000) return null;
  const match = value.match(
    /^(?:https:\/\/zamzam-web\.fly\.dev\/|zamzam:\/\/)(invite|register)\/([A-Za-z0-9_-]{16,500})\/?(?:\?[^#]*)?(?:#.*)?$/i,
  );
  return match
    ? { kind: match[1].toLowerCase() as PublicAppLink['kind'], token: match[2] }
    : null;
}
