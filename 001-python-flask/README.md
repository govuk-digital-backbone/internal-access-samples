# 001-python-flask

This example uses Flask and Authlib to implement an OAuth 2.0 client.

``` bash
python -m venv .venv

source .venv/bin/activate
## if using PowerShell
# .\.venv\Scripts\Activate.ps1

pip install -e '.[dev]'

export CLIENT_ID=abc123
export CLIENT_SECRET=def456

export OPENID_URL="https://sso.service.security.gov.uk/.well-known/openid-configuration"
## staging URL
# export OPENID_URL="https://staging.sso.service.security.gov.uk/.well-known/openid-configuration"
## localhost OAuth example should work too
# export OPENID_URL="http://localhost:6000/.well-known/openid-configuration"

## to disable TLS verification use (only for testing purposes)
# export DISABLE_TLS_VERIFICATION=True

## override default port
# export PORT=5123

flask run
```
