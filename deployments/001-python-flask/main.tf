terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    key    = "001-python-flask/terraform.tfstate"
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

  app_name       = "001-python-flask"
  image_tag      = var.image_tag
  ssm_parameters = ["client_id", "client_secret", "flask_secret_key"]
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
