# Internal Access Samples

This repository contains sample applications demonstrating integration with the GOV.UK Internal Access Single Sign-On (SSO) service.

> [!NOTE]
> Work in progress; code and integration details will likely change.

## Sample apps

| Directory | Description |
|---|---|
| [001-python-flask](001-python-flask/) | Python / Flask |
| [002-node-express](002-node-express/) | Node.js / Express |

## Adding a new sample app

### 1. Create the app

Add your app under a new directory, e.g. `003-your-app/`. It must:

- Listen on the port specified by the `PORT` environment variable (default `8080`)
- Read the following environment variables: `CLIENT_ID`, `CLIENT_SECRET`, `OPENID_URL`, and a session secret of your choosing (e.g. `SESSION_SECRET`)
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

### 3. Create the deployment config

Create `deployments/003-your-app/main.tf`:

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    key    = "003-your-app/terraform.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = "eu-west-2"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

module "app" {
  source = "../../modules/lambda-app"

  app_name       = "003-your-app"
  image_tag      = var.image_tag
  ssm_parameters = ["client_id", "client_secret", "session_secret"]
  env_vars = {
    ENVIRONMENT = "prod"
    IS_HTTPS    = "true"
    OPENID_URL  = "https://sso.service.security.gov.uk/.well-known/openid-configuration"
  }
}

output "app_url" {
  value = module.app.app_url
}

output "ecr_repository_url" {
  value = module.app.ecr_repository_url
}
```

### 4. Create the SSM parameters

Run once before deploying:

```bash
aws ssm put-parameter --name "/003-your-app/client_id"      --value "..." --type SecureString
aws ssm put-parameter --name "/003-your-app/client_secret"  --value "..." --type SecureString
aws ssm put-parameter --name "/003-your-app/session_secret" --value "..." --type SecureString
```

### 5. Add to the deployment workflow

Add a job to `.github/workflows/deploy.yml`:

```yaml
deploy-003-your-app:
  uses: ./.github/workflows/deploy-lambda-app.yml
  with:
    app_name: 003-your-app
  secrets: inherit
```

### 6. Register the callback URL

After the first deploy, get the app URL:

```bash
cd deployments/003-your-app
terraform output app_url
```

Register `<app_url>/auth/callback` with Internal Acess and then update the SSM parameters with CLIENT_ID and CLIENT_SECRET.
