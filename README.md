# Davids.Frontend.Admin

| Pull Request CI | CodeQL SAST | Platform Architecture & Orchestration |
|---|---|---|
| [![Pull Request CI — Security Gate](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml) | [![Pull Request CI — CodeQL SAST](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml) | [**`Davids` — Architecture & Security Diagram**](https://github.com/dav-Ste/Davids#architecture-project-relationships--security-posture) |

`Davids.Frontend.Admin` (`Davids.Frontend.Admin.slnx`, default local port `:17321`) hosts the separated **Admin Web frontend** (`Davids | Admin Web frontend`) for the Davids microservices platform on `.NET 10`.

## Projects

- `src/Davids.Frontend.Admin`: Static-asset and Razor/Minimal host serving the administrator SSO entry card (`/login`) and the gateway-gated customer search, editing, administrator IAM, and login-audit workspace (`/`) with strict Content-Security-Policy (`default-src 'self'; script-src 'self'; frame-ancestors 'none'`).
- `tests/Davids.Frontend.Admin.Tests`: Unit, Clean Architecture, CSP/security-header, and integration tests verifying HTML/asset delivery, health probes, and zero inline/token storage patterns.

## Passwordless frontend & Gateway OIDC BFF security

- **Zero credential or token handling in frontend JavaScript**:
  - `Davids.Frontend.Admin` never collects administrator passwords, never calls `/connect/token` or refresh endpoints, and never stores tokens in `localStorage`, `sessionStorage`, or `document.cookie`.
  - `/login` renders a hardened Single Sign-On card that initiates OAuth 2.1 **Authorization Code + PKCE (`S256`)** via `GET /auth/login?returnUrl=%2F` on [`Davids.APIGateway`](https://github.com/dav-Ste/Davids.APIGateway), redirecting the browser to [`Davids.Services.AdminIdentity`](https://github.com/dav-Ste/Davids.Services.AdminIdentity) (`/admin-identity/connect/authorize`).
- **Strict `admin` role boundary at `Davids.APIGateway` & Istio mesh**:
  - `/` and all Admin Web frontend workspace assets (`index.html`, `app.css`, `app.js`) require a verified administrator session (`AdminBffCookie` `davids_admin_bff` or `AdminBearer`, `role == "admin"`), and in Kubernetes Istio `AuthorizationPolicy` restricts ingress to `Davids.Frontend.Admin` exclusively to principal `cluster.local/ns/davids/sa/davids-api-gateway`.
  - Unauthenticated browser HTML navigations to `/` redirect (`302 Found`) to `/login`; authenticated customer users (`CustomerBearer`) receive `403 Forbidden`.
  - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) carry `X-Requested-With: DavidsAdmin` and same-origin `Origin` headers verified at `Davids.APIGateway`.
- **Complete database and cryptographic isolation**:
  - Administrator accounts are stored exclusively in `adminidentitydb` (`Davids.Services.AdminIdentity`), never in `identitydb` (`Davids.Services.Identity`) or `customersdb` (`Davids.Services.Customers`).

## Capabilities

- **Administrator OIDC Single Sign-On (`/login` -> `/auth/login` -> `/signin-oidc`)**: Initiates the Gateway BFF PKCE `S256` login flow and terminates sessions cleanly via `POST /auth/logout` (which triggers RFC 7009 server-side token revocation).
- **Administrator customer directory (`GET /customers?search=&state=&vip=`)**: Server-side search across customer full name, email, address, and customer GUID, plus lifecycle state and VIP filters.
- **Administrator customer editing (`PUT /customers/{customerId}` & `PUT /customers/{customerId}/state/{state}`)**: Edit modal loaded from `GET /customers/{customerId}` (`CustomerDetailsDto`) with full customer profile and lifecycle state updates.
- **Administrator account & login-audit management (`GET/POST /admin-identity/users` & `GET /admin-identity/login-audits`)**: Lists and provisions administrator accounts in `adminidentitydb` and inspects append-only administrator login audit events.

See [`docs/ADMIN-WEB-FRONTEND.md`](docs/ADMIN-WEB-FRONTEND.md) for endpoint contracts and OIDC BFF security details.

## Build, test & container image

Clone [`Davids.Shared`](https://github.com/dav-Ste/Davids.Shared) (`../Davids.Shared`) alongside `Davids.Frontend.Admin` (or pass `/p:UseSharedPackageReference=true` to consume `Davids.ServiceDefaults` as a NuGet package without cloning `Davids.Shared`):

```powershell
dotnet restore Davids.Frontend.Admin.slnx --locked-mode
dotnet build Davids.Frontend.Admin.slnx --no-restore -c Release -warnaserror
dotnet test Davids.Frontend.Admin.slnx --no-build --no-restore -c Release
```

Build the hardened multi-stage container image (`USER 10001:10001`, `EXPOSE 8080`) from the parent workspace directory:

```powershell
docker build -f Davids.Frontend.Admin/Dockerfile -t davids-frontend-admin:local ..
```

## Related repositories

- [`Davids`](https://github.com/dav-Ste/Davids) — `.NET 10` Aspire AppHost, Vault bootstrap, Kubernetes/Istio manifests, architecture diagram & lifecycle security suite
- [`Davids.Shared`](https://github.com/dav-Ste/Davids.Shared) — `Davids.ServiceDefaults` shared observability, Data Protection, and resilience defaults
- [`Davids.APIGateway`](https://github.com/dav-Ste/Davids.APIGateway) — YARP `2.3.0` edge reverse proxy & confidential Admin OIDC BFF
- [`Davids.Services.Identity`](https://github.com/dav-Ste/Davids.Services.Identity) — Customer OpenIddict `RS256` OIDC Provider (`identitydb`)
- [`Davids.Services.AdminIdentity`](https://github.com/dav-Ste/Davids.Services.AdminIdentity) — Administrator OpenIddict `RS256` OIDC Provider (`adminidentitydb`)
- [`Davids.Services.Customers`](https://github.com/dav-Ste/Davids.Services.Customers) — Customer profiles & order tracking API (`customersdb`)
