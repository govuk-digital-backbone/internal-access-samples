terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bucket is passed via -backend-config at init time (see deploy.yml)
  backend "s3" {
    key    = "001-python-flask/terraform.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-2"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "openid_url" {
  description = "OIDC discovery document URL"
  type        = string
  default     = "https://sso.service.security.gov.uk/.well-known/openid-configuration"
}

# ---------------------------------------------------------------------------
# SSM Parameters
# ---------------------------------------------------------------------------

data "aws_ssm_parameter" "client_id" {
  name            = "/001-python-flask/client_id"
  with_decryption = true
}

data "aws_ssm_parameter" "client_secret" {
  name            = "/001-python-flask/client_secret"
  with_decryption = true
}

data "aws_ssm_parameter" "flask_secret_key" {
  name            = "/001-python-flask/flask_secret_key"
  with_decryption = true
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  name                 = "001-python-flask"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda" {
  name = "001-python-flask-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------------------------
# Lambda function
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "app" {
  function_name = "001-python-flask"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      ENVIRONMENT      = "prod"
      IS_HTTPS         = "true"
      OPENID_URL       = var.openid_url
      CLIENT_ID        = data.aws_ssm_parameter.client_id.value
      CLIENT_SECRET    = data.aws_ssm_parameter.client_secret.value
      FLASK_SECRET_KEY = data.aws_ssm_parameter.flask_secret_key.value
    }
  }
}

resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Free HTTPS endpoint — no API Gateway needed
resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "app_url" {
  description = "Public HTTPS URL — register <app_url>/auth/callback with your OIDC provider"
  value       = aws_lambda_function_url.app.function_url
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing images"
  value       = aws_ecr_repository.app.repository_url
}
