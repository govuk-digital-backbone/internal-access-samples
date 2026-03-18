# Internal Access Samples

This repository contains sample applications demonstrating integration with the GOV.UK Internal Access Single Sign-On (SSO) service.

> [!NOTE]
> Work in progress; code and integration details will likely change.

## Sample apps

| Environment | Description | URL |
|---|---|---|
| prod | Python / Flask | https://6ambnwrmzm2c6jgm6fh3xcsefu0puhsv.lambda-url.eu-west-2.on.aws/ |
| prod | Node.js / Express | https://33voszsz6yrukuqukklexdqxom0zgvbx.lambda-url.eu-west-2.on.aws/ |
| staging | Python / Flask | https://aqgtr6grsva2qsxffiyaoqwzi40yzovz.lambda-url.eu-west-2.on.aws/ |
| staging | Node.js / Express | https://ppbk7d7beuxv2bke3dt2k7ulua0hbvdn.lambda-url.eu-west-2.on.aws/ |
| dev | Python / Flask | https://lguv6kyr6jdp3um2rvooukrnaq0sjcoy.lambda-url.eu-west-2.on.aws/ |
| dev | Node.js / Express | https://h5wcfgg4axpm25zgseuy7th4540rcgon.lambda-url.eu-west-2.on.aws/ |


## Environments

Every push to `main` deploys all apps to **dev**, **staging**, and **prod** simultaneously. Each environment is independent:

- Resources are named `<environment>-<app-name>` (e.g. `dev-001-python-flask`)
- SSM parameters are scoped to `/<environment>/<app-name>/<param>`
- Terraform state is stored at `<environment>/terraform.tfstate` in the S3 backend bucket
- The frontend displays a colour-coded banner so it is always clear which environment you are looking at

## Adding a new sample app

### 1. Create the app

Add your app under a new directory, e.g. `003-your-app/`. It must:

- Listen on the port specified by the `PORT` environment variable (default `8080`)
- Read the following environment variables: `CLIENT_ID`, `CLIENT_SECRET`, `OPENID_URL`, and a session secret of your choosing (e.g. `SESSION_SECRET`)
- Read `ENVIRONMENT` to display the current environment in the UI (`dev`, `staging`, or `prod`)
- Implement the OIDC authorisation code flow with the following routes:
  - `GET /` — home page
  - `GET /sign-in` — redirect to the OIDC provider
  - `GET /auth/callback` — handle the OIDC callback
  - `GET /sign-out` — clear the session and redirect to the OIDC provider's end session endpoint

### 2. Add a Dockerfile

Your `Dockerfile` must include the Lambda Web Adapter and start your app on `PORT=8080`:

```dockerfile
FROM <your-base-image>
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# ... install dependencies, copy app files ...

ENV PORT=8080
CMD [<your-start-command>]
```

### 3. Register the app in the deployment config

Add one entry to the `apps` map in `deployments/main.tf`:

```hcl
"003-your-app" = {
  ssm_parameters = ["client_id", "client_secret", "session_secret"]
}
```

That's it. The app will be built and deployed across all three environments on the next push to `main`.

### 4. Create the SSM parameters

Run once per environment before deploying:

```bash
for env in dev staging prod; do
  aws ssm put-parameter --name "/$env/003-your-app/client_id"     --value "..." --type SecureString
  aws ssm put-parameter --name "/$env/003-your-app/client_secret" --value "..." --type SecureString
done
```

Check with the Internal Access team for the correct endpoint for each environment.

### 5. Register the callback URLs

After the first deploy, get the app URLs:

```bash
cd deployments
terraform output -json app_urls | jq '.["003-your-app"]'
```

Register `<app_url>/auth/callback` with Internal Access for each environment, then update the SSM parameters with the corresponding `CLIENT_ID` and `CLIENT_SECRET`.
