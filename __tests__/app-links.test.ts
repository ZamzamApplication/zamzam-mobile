import { publicAppLink } from '../src/app-links';

describe('public app link routing', () => {
  const token = 'abcdABCD0123_-abcdABCD0123_-abcdABCD0123_abc';
  it.each(['invite', 'register'] as const)(
    'handles cold/warm %s URLs and custom-scheme fallback',
    kind => {
      expect(
        publicAppLink(`https://zamzam-web.fly.dev/${kind}/${token}`),
      ).toEqual({ kind, token });
      expect(publicAppLink(`zamzam://${kind}/${token}`)).toEqual({
        kind,
        token,
      });
      expect(
        publicAppLink(
          `https://zamzam-web.fly.dev/${kind}/${token}/?source=qr#form`,
        ),
      ).toEqual({ kind, token });
    },
  );
  it('ignores unrelated origins, print pages, invalid tokens and misleading paths', () => {
    for (const value of [
      null,
      '',
      `https://evil.example/register/${token}`,
      `http://zamzam-web.fly.dev/invite/${token}`,
      `https://zamzam-web.fly.dev.evil.example/invite/${token}`,
      `https://zamzam-web.fly.dev/register/${token}/print`,
      `zamzam://register/short`,
      `zamzam://register/${token}/extra`,
      `zamzam://invite/${'a'.repeat(501)}`,
      `https://zamzam-web.fly.dev/login?next=/invite/${token}`,
    ])
      expect(publicAppLink(value)).toBeNull();
  });
});
