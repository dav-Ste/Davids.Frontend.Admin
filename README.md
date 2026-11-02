# Davids.Frontend.Admin

[![Pull Request CI — Security Gate](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/pull-request-ci.yml)
[![Pull Request CI — CodeQL SAST](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/dav-Ste/Davids.Frontend.Admin/actions/workflows/codeql.yml)

`Davids.Frontend.Admin` hosts the separated **Admin Web frontend** (`Davids | Admin Web frontend`) for the Davids microservices platform on `.NET 10`.

## Passwordless Frontend & Gateway OIDC BFF Security

- **Zero credential or token handling in frontend JavaScript**:
  - `Davids.Frontend.Admin` never collects administrator passwords, never calls `/connect/token` or refresh endpoints, and never stores tokens in `localStorage`, `sessionStorage`, or `document.cookie`.
  - `/login` renders a hardened Single Sign-On card that initiates OAuth 2.1 **Authorization Code + PKCE (`S256`)** via `GET /auth/login?returnUrl=%2F` on `Davids.APIGateway`, redirecting the browser to `Davids.Services.AdminIdentity` (`/admin-identity/connect/authorize`).
- **Strict `admin` role boundary at `Davids.APIGateway`**:
  - `/` and all Admin Web frontend workspace assets (`index.html`, `app.css`, `app.js`, etc.) require a verified administrator session (`AdminBffCookie` `davids_admin_bff` or `AdminBearer`, `role == "admin"`).
  - Unauthenticated browser HTML navigations to `/` redirect (`302 Found`) to `/login`; authenticated customer users (`CustomerBearer`) receive `403 Forbidden`.
  - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) carry `X-Requested-With: DavidsAdmin` and same-origin `Origin` headers verified at `Davids.APIGateway`.
- **Complete database and cryptographic isolation**:
  - Administrator accounts are stored exclusively in `adminidentitydb` (`Davids.Services.AdminIdentity`), never in `identitydb` (`Davids.Services.Identity`) or `customersdb` (`Davids.Services.Customers`).

## Capabilities

1. **Administrator OIDC Single Sign-On (`/login` -> `/auth/login` -> `/signin-oidc`)**
   - Initiates the Gateway BFF PKCE login flow and terminates sessions cleanly via `POST /auth/logout` (which triggers RFC 7009 server-side token revocation).
2. **Administrator Customer Directory (`GET /customers?search=&state=&vip=`)**
   - Server-side search across customer full name, email, address, and customer GUID, plus lifecycle state and VIP filters.
3. **Administrator Customer Editing (`PUT /customers/{customerId}` & `PUT /customers/{customerId}/state/{state}`)**
   - Edit modal loaded from `GET /customers/{customerId}` (`CustomerDetailsDto`) with full customer profile & state updates.
4. **Administrator Account Management (`GET /admin-identity/users` & `POST /admin-identity/users`)**
   - Lists administrator accounts in `adminidentitydb` and allows verified administrators to provision new `admin` accounts.

## Build & Test

Clone the sibling `Davids.Shared` repository (`../Davids.Shared`) alongside `Davids.Frontend.Admin` (the `Davids` Aspire infrastructure repository is not required for standalone builds/tests):

```powershell
dotnet restore .\Davids.Frontend.Admin.slnx --locked-mode
dotnet build .\Davids.Frontend.Admin.slnx -c Release --no-restore
dotnet test .\Davids.Frontend.Admin.slnx -c Release --no-build
```

See [`docs/ADMIN-WEB-FRONTEND.md`](docs/ADMIN-WEB-FRONTEND.md) for endpoint contracts and OIDC BFF security details.
