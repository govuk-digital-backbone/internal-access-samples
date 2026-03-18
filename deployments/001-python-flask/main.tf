terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    region = "eu-west-2"
    # key is supplied via -backend-config in CI: <environment>/001-python-flask/terraform.tfstate
  }
}

provider "aws" {
  region = "eu-west-2"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

module "app" {
  source = "../../modules/lambda-app"

  app_name       = "001-python-flask"
  environment    = var.environment
  image_tag      = var.image_tag
  ssm_parameters = ["client_id", "client_secret", "flask_secret_key", "openid_url"]
  env_vars = {
    ENVIRONMENT = var.environment
    IS_HTTPS    = "true"
  }
}

output "app_url" {
  value = module.app.app_url
}

output "ecr_repository_url" {
  value = module.app.ecr_repository_url
}
