# Security Policy

## Reporting a vulnerability

Do not open a public issue for a security vulnerability. Report privately to
the project maintainer with the affected URL, contract, route, or file, clear
reproduction steps, impact, and any suggested mitigation.

Until a security contact is published, use the private security advisory flow
on the GitHub repository. Remove API keys, private keys, webhook secrets, and
personal data from reports.

## Trust boundaries

- The platform wallet relays dashboard and API-authorized GenLayer writes.
- Campaign API keys authorize scoped review operations but never sign chain
  transactions.
- Repository, issue, patch, test, and CI content is untrusted evidence and may
  contain prompt injection.
- The protocol recommends rewards but never holds or transfers campaign funds.

## Supported releases

The active deployed contract version and production API receive security fixes.
Superseded StudioNet deployments are read-only references and must not receive
new credentials or traffic.
