#!/usr/bin/env python

import os
import secrets

from flask import Flask, session, url_for, redirect, request, render_template
from functools import wraps
from authlib.integrations.flask_client import OAuth
from datetime import timedelta

app = Flask(__name__)


def env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if not v:
        return default
    return v.strip().lower()[0] in ["1", "t", "y"]


CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
OPENID_URL = os.getenv(
    "OPENID_URL",
    "https://sso.service.security.gov.uk/.well-known/openid-configuration",
)
if not CLIENT_ID or not CLIENT_SECRET or not OPENID_URL:
    print(
        "Missing one or more required environment variables (CLIENT_ID, CLIENT_SECRET, OPENID_URL)."
    )
    exit(1)

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
DEBUG = env_bool("FLASK_DEBUG", ENVIRONMENT.startswith("dev"))
PORT = int(os.getenv("PORT", "5000"))

IS_HTTPS = env_bool("IS_HTTPS", False)
COOKIE_PREFIX = "__Host-" if IS_HTTPS else ""
COOKIE_NAME_SESSION = f"{COOKIE_PREFIX}session-govuk-ia-001"
DISABLE_TLS_VERIFICATION = env_bool("DISABLE_TLS_VERIFICATION", False)
if DISABLE_TLS_VERIFICATION:
    if ENVIRONMENT.startswith("prod"):
        print("Cannot disable TLS verifcation in production.")
        exit(1)
    print("=" * 20)
    print("TLS verification disabled, do not use in production!")
    print("-" * 20)
    import ssl
    import requests

    ssl._create_default_https_context = ssl._create_unverified_context
    old_request = requests.sessions.Session.request

    def _patched_request(self, method, url, **kwargs):
        kwargs.setdefault("verify", False)
        return old_request(self, method, url, **kwargs)

    requests.sessions.Session.request = _patched_request

app.config.update(
    ENV=ENVIRONMENT,
    SESSION_COOKIE_NAME=COOKIE_NAME_SESSION,
    SESSION_COOKIE_DOMAIN=None,
    SESSION_COOKIE_PATH="/",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=IS_HTTPS,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    SECRET_KEY=os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(24)),
    MAX_CONTENT_LENGTH=120 * 1024 * 1024,
)

oauth = OAuth()
oauth.register(
    name="oidc",
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    server_metadata_url=OPENID_URL,
    client_kwargs={"scope": "openid profile email"},
)
oauth.init_app(app)


def UserShouldBeSignedIn(f):
    """
    Decorator to ensure the user is signed in.
    It checks if the session has a 'signed_in' key set to True.
    If the user is signed in, it allows the request to proceed; otherwise, it redirects to the sign-in page.
    :param f: The function to wrap.
    :return: Wrapped function that checks if the user is signed in.
    """

    @wraps(f)
    def wrap(*args, **kwds):
        if "signed_in" in session and session["signed_in"]:
            return f(*args, **kwds)

        session.clear()

        redirect_uri = request.url
        session["redirect_uri"] = redirect_uri
        auth_redirect_uri = oauth.oidc.authorize_redirect(redirect_uri)
        return auth_redirect_uri

    return wrap


@app.route("/")
def route_home():
    signed_in = session.get("signed_in", False)
    return render_template(
        "index.html",
        signed_in=signed_in,
    )


@app.route("/sign-in")
def route_signin():
    home_url = url_for("route_home", _external=True)
    session["redirect_uri"] = home_url

    redirect_uri = url_for("route_auth_callback", _external=True)
    auth_redirect_uri = oauth.oidc.authorize_redirect(redirect_uri)
    return auth_redirect_uri


@app.route("/sign-out")
def route_signout():
    session.clear()

    logout_redirect_uri = url_for("route_home", _external=True)
    if "end_session_endpoint" in oauth.oidc.server_metadata:
        end_session_endpoint = oauth.oidc.server_metadata["end_session_endpoint"]
        return redirect(
            f"{end_session_endpoint}?client_id={oauth.oidc.client_id}&post_logout_redirect_uri={logout_redirect_uri}"
        )
    return redirect(logout_redirect_uri)


@app.route("/auth/callback", methods=["GET"])
def route_auth_callback():
    token = oauth.oidc.authorize_access_token()
    if (
        "userinfo" in token
        and "email_verified" in token["userinfo"]
        and token["userinfo"]["email_verified"]
    ):
        redirect_uri = session.get("redirect_uri", "/")

        session.clear()

        email = token["userinfo"]["email"]
        display_name = token["userinfo"].get("display_name", "")
        if not display_name:
            display_name = email.split("@")[0]

        session["signed_in"] = True
        session["user"] = {
            "display_name": display_name,
            "email": email,
        }
        if picture := token["userinfo"].get("picture", None):
            session["user"]["picture"] = picture

        return redirect(redirect_uri)

    return redirect("/error?type=auth-callback-failed")


def main():
    app.run(host="127.0.0.1", port=PORT, debug=DEBUG)


if __name__ == "__main__":
    main()
