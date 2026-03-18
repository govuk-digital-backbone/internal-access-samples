terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    key    = "terraform.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = "eu-west-2"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# ---------------------------------------------------------------------------
# Apps
# To add a new app, add an entry here. The key must match the app directory
# name under the repo root (used for Docker builds).
# ---------------------------------------------------------------------------

locals {
  apps = {
    "001-python-flask" = {
      ssm_parameters = ["client_id", "client_secret", "flask_secret_key", "openid_url"]
    }
    "002-node-express" = {
      ssm_parameters = ["client_id", "client_secret", "session_secret", "openid_url"]
    }
  }
}

module "app" {
  for_each = local.apps
  source   = "../modules/lambda-app"

  app_name       = each.key
  image_tag      = var.image_tag
  ssm_parameters = each.value.ssm_parameters
}

output "app_urls" {
  description = "Public HTTPS URLs for all deployed apps"
  value       = { for k, v in module.app : k => v.app_url }
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for all apps"
  value       = { for k, v in module.app : k => v.ecr_repository_url }
}
