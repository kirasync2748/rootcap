export function getSecret(): string {
  const secret = process.env.ROOTCAP_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV !== "development")
      throw new Error("ROOTCAP_SECRET must contain at least 16 characters");
    // Fallback for local development only.
    return "rootcap-dev-fallback-secret-0123456789abcdef";
  }
  return secret;
}
