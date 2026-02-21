# Aegis Nitro Enclave — Terraform deployment for AWS.
#
# Creates a VPC with private subnet, an EC2 instance with Nitro Enclave
# support, IAM roles for KMS access, and security groups.
#
# Usage:
#   terraform init
#   terraform plan -var="key_pair_name=my-key"
#   terraform apply -var="key_pair_name=my-key"

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── VPC ──────────────────────────────────────────────────────────

resource "aws_vpc" "aegis" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "aegis-nitro-vpc"
  }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.aegis.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "aegis-nitro-private"
  }
}

# ── Security Group ───────────────────────────────────────────────

resource "aws_security_group" "aegis_enclave" {
  name_prefix = "aegis-enclave-"
  vpc_id      = aws_vpc.aegis.id

  # No inbound access (enclave is isolated)
  # Outbound: only KMS endpoint for key management
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to AWS KMS"
  }

  tags = {
    Name = "aegis-enclave-sg"
  }
}

# ── IAM Role ─────────────────────────────────────────────────────

resource "aws_iam_role" "aegis_enclave" {
  name = "aegis-nitro-enclave-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "kms_access" {
  name = "aegis-kms-access"
  role = aws_iam_role.aegis_enclave.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey",
        ]
        Resource = var.kms_key_arn != "" ? [var.kms_key_arn] : ["*"]
        Condition = {
          StringEqualsIgnoreCase = {
            "kms:RecipientAttestation:PCR0" = var.enclave_pcr0
          }
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "aegis_enclave" {
  name = "aegis-nitro-enclave-profile"
  role = aws_iam_role.aegis_enclave.name
}

# ── EC2 Instance ─────────────────────────────────────────────────

resource "aws_instance" "aegis_enclave" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.private.id
  vpc_security_group_ids = [aws_security_group.aegis_enclave.id]
  iam_instance_profile   = aws_iam_instance_profile.aegis_enclave.name

  enclave_options {
    enabled = true
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-EOF
    #!/bin/bash
    yum install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel
    systemctl enable nitro-enclaves-allocator.service
    systemctl start nitro-enclaves-allocator.service

    # Pull and run the Aegis enclave
    nitro-cli run-enclave \
      --eif-path /opt/aegis/aegis.eif \
      --memory 512 \
      --cpu-count 2
  EOF

  tags = {
    Name = "aegis-nitro-enclave"
  }
}
