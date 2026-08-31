# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities responsibly and **do not open a public issue** for them.

> **Security contact:** `<PROJECT-OWNER: configure a security contact email or a GitHub private vulnerability report before publishing this repository>`

Until a contact is configured, use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) for this repository if enabled.

When reporting, please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept where possible)
- Affected component (web, API, worker, infrastructure)
- Any suggested remediation

### Response Process

- Acknowledgement of your report as soon as reasonably possible.
- An assessment of severity and affected versions.
- A fix or mitigation plan, and coordinated disclosure once resolved.

## Supported Versions

URLPulse is pre-1.0 and under active development. Only the latest `main` is supported. This table will be updated once versioned releases exist.

| Version | Supported |
|---------|-----------|
| main    | ✅        |

## Application Security Considerations

URLPulse performs **outbound HTTP requests based on user-provided URLs**. This makes **Server-Side Request Forgery (SSRF)** a primary security concern.

### Current Controls

The application is being implemented. As of now, no runtime security controls are implemented in code. Do **not** treat any protection below as present until the corresponding code exists and is tested. This section will be updated to reflect real controls as they land.

### Recommended Production Hardening

Before running URLPulse against untrusted input in production, deployments **should** implement and verify:

**SSRF protection** - reject or restrict requests targeting:

- Private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Loopback (`127.0.0.0/8`, `::1`) and `localhost`
- Link-local addresses (`169.254.0.0/16`, `fe80::/10`)
- Cloud metadata endpoints (e.g. `169.254.169.254`)
- Internal DNS names and internal-only hosts
- IPv4/IPv6 edge cases and alternate encodings (decimal/octal/hex IPs, IPv4-mapped IPv6)
- **Redirects** that resolve to any restricted destination - re-validate the target of every redirect hop, not just the initial URL

**Input handling**

- Validate URL scheme (allow only `http`/`https`) and structure at the trust boundary.
- Validate uploaded CSV files: enforce size limits, row/column limits, and content-type; reject malformed input.
- Limit overall input size (number of URLs per batch, request body size).

**Operational**

- Do not leak internal errors or stack traces to clients; return safe error shapes.
- Do not log secrets, credentials, tokens, or full request/response bodies containing sensitive data.
- Protect infrastructure credentials; never commit them. Use `.env` (git-ignored) and a secrets manager in production.
- Secure Redis and PostgreSQL access with authentication and network isolation; do not expose them publicly.
- Configure the HTTP client's redirect and timeout behavior explicitly.

The distinction between **current controls** and **recommended hardening** must be kept accurate as the implementation evolves.
