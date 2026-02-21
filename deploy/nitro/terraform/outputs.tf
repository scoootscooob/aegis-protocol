# Aegis Nitro Enclave — Terraform outputs.

output "instance_id" {
  description = "EC2 instance ID running the Nitro Enclave"
  value       = aws_instance.aegis_enclave.id
}

output "private_ip" {
  description = "Private IP of the enclave instance"
  value       = aws_instance.aegis_enclave.private_ip
}

output "vpc_id" {
  description = "VPC ID for the enclave deployment"
  value       = aws_vpc.aegis.id
}

output "security_group_id" {
  description = "Security group for the enclave instance"
  value       = aws_security_group.aegis_enclave.id
}
