import express from "express";
import { getOidcClient } from "../client/oidcClient.js";
import { generators } from "openid-client";

const router = express.Router();
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const CLIENT_ID = process.env.CLIENT_ID;
const callbackUrl = "http://localhost:3000/auth/callback";

router.get('/', (req, res) => {
  const signedIn = req.session?.signed_in === true;
  res.render('sign-in/index.njk', {
    signed_in: signedIn,
    user: req.session?.user || null,
    environment: ENVIRONMENT
  });
});

router.get('/sign-in', async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const state = generators.state();
    const nonce = generators.nonce();

    req.session
    
    req.session.oidc_nonce = nonce;
    req.session.oidc_state = state;
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

router.get('/sign-out', async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const homeUrl = `${req.protocol}://${req.get('host')}/`;

    req.session.destroy;

    const metadata = client.issuer.metadata;
    if (metadata.end_session_endpoint) {
      const logoutUrl = new URL(metadata.end_session_endpoint);
      logoutUrl.searchParams.set('client_id', CLIENT_ID ?? "");
      logoutUrl.searchParams.set('post_logout_redirect_uri', homeUrl);
      return res.redirect(logoutUrl.toString());
    }

    res.redirect(homeUrl);
  } catch (err) {
    next(err);
  }
});

router.get('/auth/callback', async (req, res, next) => {
  try {
    const client = await getOidcClient();

    const state = req.session.oidc_state || undefined;
    const nonce = req.session.oidc_nonce || undefined;
    const redirectUri = req.session.redirect_uri || '/';

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(callbackUrl, params, { state, nonce });

    const userinfo = tokenSet.claims();

    if (!userinfo.email_verified) {
      return res.redirect('/error?type=auth-callback-failed');
    }

    const email = userinfo.email;
    let displayName = userinfo.display_name || '';
    if (!displayName && email) {
      displayName = email.split('@')[0];
    }

    // Clear session then set new values
    req.session.destroy;
    req.session.signed_in = true;
    req.session.user = {
        display_name: displayName,
        email,
        ...(userinfo.picture ? { picture: userinfo.picture } : {}),
      };

    res.redirect(redirectUri);
  } catch (err) {
    next(err);
  }
});

export { router as indexRouter };
