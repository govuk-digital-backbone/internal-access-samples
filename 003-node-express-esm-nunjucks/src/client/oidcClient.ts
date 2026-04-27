import { BaseClient, Issuer } from "openid-client";

let oidcClient: BaseClient | null = null;
const OPENID_URL = process.env.OPENID_URL || 'https://sso.service.security.gov.uk/.well-known/openid-configuration';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

export async function getOidcClient() {
  if (oidcClient) {
    return oidcClient;
  }
  const issuer = await Issuer.discover(OPENID_URL);
  oidcClient = new issuer.Client({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET,
    redirect_uris: ['http://localhost:3000/auth/callback'],
    response_types: ['code'],
  });
  return oidcClient;
}