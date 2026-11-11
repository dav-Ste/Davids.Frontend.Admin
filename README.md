# Davids.Frontend.Admin

| Pull Request CI | CodeQL SAST | Platform Architecture & Orchestration |
|---|---|---|
| [![CI — Build, Tests & Security](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml) | [![CodeQL — PR, Main & Weekly SAST](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml) | [**`Davids` — Architecture & Security Diagram**](https://github.com/dav-Ste/Davids#architecture-project-relationships--security-posture) |

`Davids.Frontend.Admin` (`Davids.Frontend.Admin.slnx`, default local port `:17321`) hosts the separated **Admin Web frontend** (`Davids | Admin Web frontend`) for the Davids microservices platform on `.NET 10`.

## Projects

- `src/Davids.Frontend.Admin`: Static-asset and Razor/Minimal host serving the administrator SSO entry card (`/admin/login`) and the gateway-gated customer search, editing, administrator IAM, and login-audit workspace (`/admin`) with strict Content-Security-Policy (`default-src 'self'; script-src 'self'; frame-ancestors 'none'`).
- `tests/Davids.Frontend.Admin.Tests`: Unit, Clean Architecture, CSP/security-header, and integration tests verifying HTML/asset delivery, health probes, and zero inline/token storage patterns.

## Passwordless frontend & Gateway OIDC BFF security

- **Zero credential or token handling in frontend JavaScript**:
  - `Davids.Frontend.Admin` never collects administrator passwords, never calls `/connect/token` or refresh endpoints, and never stores tokens in `localStorage`, `sessionStorage`, or `document.cookie`.
  - `/admin/login` renders a hardened Single Sign-On card that initiates OAuth 2.1 **Authorization Code + PKCE (`S256`)** via `GET /auth/login?returnUrl=%2Fadmin` on [`Davids.APIGateway`](https://github.com/dav-Ste/Davids.APIGateway), redirecting the browser to [`Davids.Services.AdminIdentity`](https://github.com/dav-Ste/Davids.Services.AdminIdentity) (`/admin-identity/connect/authorize`).
- **Strict workforce role boundary at `Davids.APIGateway` & Istio mesh**:
  - `/admin` and all Admin Web frontend workspace assets (`index.html`, `app.css`, `app.js`) require a verified workforce session (`AdminBffCookie` `davids_admin_bff` or `AdminBearer`, role `admin`, `support`, or `auditor`), and in Kubernetes Istio `AuthorizationPolicy` restricts ingress to `Davids.Frontend.Admin` exclusively to principal `cluster.local/ns/davids/sa/davids-api-gateway`.
  - Unauthenticated browser HTML navigations to `/admin` redirect (`302 Found`) to `/admin/login`; customer-only sessions cannot access protected workforce assets or APIs.
  - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) carry `X-Requested-With: DavidsAdmin` and same-origin `Origin` headers verified at `Davids.APIGateway`.
- **Complete database and cryptographic isolation**:
  - Administrator accounts are stored exclusively in `adminidentitydb` (`Davids.Services.AdminIdentity`), never in `identitydb` (`Davids.Services.Identity`) or `customersdb` (`Davids.Services.Customers`).

## Capabilities

- **Workforce OIDC Single Sign-On (`/admin/login` -> `/auth/login` -> `/signin-oidc`)**: Initiates the Gateway BFF PKCE `S256` login flow for workforce roles (`admin`, `support`, `auditor`), supports self-service employee password rotation (`PUT /admin-identity/me/password`), and terminates sessions cleanly via `POST /auth/logout` (RFC 7009 revocation).
- **Customer directory & CIAM support (`GET /customers`, `PUT /customers/{customerId}`, `/customer-accounts/users/{userId}`)**: Role-aware customer search, profile/state editing (`admin` and `support`; read-only for `auditor`), customer lockout unlock (`POST /customer-accounts/users/{userId}/unlock`), and verified customer email recovery (`PUT /customer-accounts/users/{userId}/email`).
- **Workforce IAM & unified audit trails (`GET/POST/PUT /admin-identity/users`, `/admin/audits`)**: `admin`-only workforce account creation, role assignment (`admin`/`support`/`auditor` with last-admin protection), deactivation, and unlock, plus unified Workforce IAM, Customer Profile, Customer CIAM, and Login Audit views for `admin`, `support`, and `auditor`.

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
- [`Davids.Frontend.Web`](https://github.com/dav-Ste/Davids.Frontend.Web) — Customer Self-Service Web Portal (`CustomerBffCookie` PKCE `S256` BFF)

Use the gateway origin for authentication and APIs: `http://localhost:17320/admin` (or HTTPS when configured). The direct frontend port is an asset host, not an authenticated entry point.
