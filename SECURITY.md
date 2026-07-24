# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Please do NOT open a public GitHub issue.**

Instead, send a private disclosure to the maintainers. You can:

1. **GitHub Security Advisories** — Use the [Security Advisory form](https://github.com/your-org/covas/security/advisories/new)
2. **Email** — Contact the maintainers directly if GitHub advisories are not available

We aim to acknowledge reports within **48 hours** and provide a timeline for remediation.

## Security Best Practices for Integrators

If you're embedding Covas in your application:

- Validate and sanitize all image inputs before passing them to the workspace
- Use Content Security Policy (CSP) headers in production
- Keep `@covas/*` packages up to date to receive security patches
- Review network requests made by the workspace (image loading, export endpoints)
