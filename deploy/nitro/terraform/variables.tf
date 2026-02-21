# Aegis Nitro Enclave — Terraform variables.

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type (must support Nitro Enclaves)"
  type        = string
  default     = "m5.xlarge"
}

variable "ami_id" {
  description = "Amazon Linux 2 AMI ID (use latest for your region)"
  type        = string
  default     = "ami-0c02fb55956c7d316" # Amazon Linux 2 us-east-1
}

variable "key_pair_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used by the enclave (empty = any key)"
  type        = string
  default     = ""
}

variable "enclave_pcr0" {
  description = "PCR0 hash of the enclave image for KMS attestation policy"
  type        = string
  default     = ""
}
