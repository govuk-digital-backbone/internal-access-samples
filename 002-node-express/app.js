#!/usr/bin/env node

'use strict';

const express = require('express');
const cookieSession = require('cookie-session');
const { Issuer, generators } = require('openid-client');

const app = express();

// Trust the first proxy so req.protocol is correct behind Lambda Web Adapter
app.set('trust proxy', 1);
app.set('view engine', 'ejs');

// --- Environment variables ---

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const OPENID_URL = process.env.OPENID_URL || 'https://sso.service.security.gov.uk/.well-known/openid-configuration';
const SESSION_SECRET = process.env.SESSION_SECRET;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const IS_HTTPS = (process.env.IS_HTTPS || '').trim().toLowerCase().charAt(0) === 't'
  || (process.env.IS_HTTPS || '').trim().toLowerCase().charAt(0) === '1'
  || (process.env.IS_HTTPS || '').trim().toLowerCase().charAt(0) === 'y';
const PORT = parseInt(process.env.PORT || '8080', 10);

if (!CLIENT_ID || !CLIENT_SECRET || !SESSION_SECRET) {
  console.error('Missing one or more required environment variables (CLIENT_ID, CLIENT_SECRET, SESSION_SECRET).');
  process.exit(1);
}

// --- Session middleware ---

app.use(cookieSession({
  name: 'session-govuk-ia-002',
  keys: [SESSION_SECRET],
  httpOnly: true,
  secure: IS_HTTPS,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
}));

// --- Lazy OIDC client initialisation ---

let oidcClient = null;

async function getOidcClient() {
  if (oidcClient) {
    return oidcClient;
  }
  const issuer = await Issuer.discover(OPENID_URL);
  oidcClient = new issuer.Client({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uris: [], // set dynamically per request
    response_types: ['code'],
  });
  return oidcClient;
}

// --- Routes ---

app.get('/', (req, res) => {
  const signedIn = req.session.signed_in === true;
  res.render('index', {
    signed_in: signedIn,
    user: req.session.user || null,
    environment: ENVIRONMENT,
  });
});

app.get('/sign-in', async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const callbackUrl = `${req.protocol}://${req.get('host')}/auth/callback`;

    req.session.oidc_state = state;
    req.session.oidc_nonce = nonce;
    req.session.redirect_uri = `${req.protocol}://${req.get('host')}/`;

    const authUrl = client.authorizationUrl({
      scope: 'openid profile email',
      redirect_uri: callbackUrl,
      state,
      nonce,
    });

    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

app.get('/sign-out', async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const homeUrl = `${req.protocol}://${req.get('host')}/`;

    req.session = null;

    const metadata = client.issuer.metadata;
    if (metadata.end_session_endpoint) {
      const logoutUrl = new URL(metadata.end_session_endpoint);
      logoutUrl.searchParams.set('client_id', CLIENT_ID);
      logoutUrl.searchParams.set('post_logout_redirect_uri', homeUrl);
      return res.redirect(logoutUrl.toString());
    }

    res.redirect(homeUrl);
  } catch (err) {
    next(err);
  }
});

app.get('/auth/callback', async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const callbackUrl = `${req.protocol}://${req.get('host')}/auth/callback`;

    const state = req.session.oidc_state;
    const nonce = req.session.oidc_nonce;
    const redirectUri = req.session.redirect_uri || '/';

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(callbackUrl, params, { state, nonce });

    const userinfo = tokenSet.claims();

    if (!userinfo.email_verified) {
      return res.redirect('/error?type=auth-callback-failed');
    }

    const email = userinfo.email;
    let displayName = userinfo.display_name || '';
    if (!displayName) {
      displayName = email.split('@')[0];
    }

    // Clear session then set new values
    req.session = null;
    req.session = {
      signed_in: true,
      user: {
        display_name: displayName,
        email,
        ...(userinfo.picture ? { picture: userinfo.picture } : {}),
      },
    };

    res.redirect(redirectUri);
  } catch (err) {
    next(err);
  }
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
