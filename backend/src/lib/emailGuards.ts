// Basic email hygiene: format check + disposable-domain blacklist.

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "trashmail.com",
  "fakeinbox.com",
  "mintemail.com",
  "mailnesia.com",
  "tempr.email",
  "discard.email",
  "spamgourmet.com",
  "mytemp.email",
  "burnermail.io",
]);

export function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return DISPOSABLE_DOMAINS.has(domain);
}
