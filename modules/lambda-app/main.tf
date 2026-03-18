# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "app_name" {
  description = "Application name — used for all resource names and SSM paths"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-2"
}

variable "ssm_parameters" {
  description = "Names of SSM parameters to read from /<workspace>/<app_name>/<name>"
  type        = list(string)
}

variable "env_vars" {
  description = "Extra environment variables to pass to the Lambda function"
  type        = map(string)
  default     = {}
}

locals {
  resource_name = "${terraform.workspace}-${var.app_name}"
}

# ---------------------------------------------------------------------------
# SSM Parameters
# ---------------------------------------------------------------------------

data "aws_ssm_parameter" "params" {
  for_each        = toset(var.ssm_parameters)
  name            = "/${terraform.workspace}/${var.app_name}/${each.key}"
  with_decryption = true
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  name                 = local.resource_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda" {
  name = "${local.resource_name}-lambda"

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
  function_name = local.resource_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = merge(
      { for name in var.ssm_parameters : upper(name) => data.aws_ssm_parameter.params[name].value },
      {
        ENVIRONMENT = terraform.workspace
        IS_HTTPS    = "true"
      },
      var.env_vars
    )
  }
}

resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "app_url" {
  description = "Public HTTPS URL for the Lambda function"
  value       = aws_lambda_function_url.app.function_url
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing images"
  value       = aws_ecr_repository.app.repository_url
}
