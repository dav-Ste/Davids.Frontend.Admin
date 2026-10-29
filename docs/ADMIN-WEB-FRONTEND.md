# Admin Web Frontend (`Davids.Frontend.Admin`)

`Davids.Frontend.Admin` is the standalone `.NET 10` web asset host for the **Admin Web frontend**, restricted exclusively to `admin` users authenticated through the self-hosted **OpenID Connect (`OpenIddict`)** provider in `Davids.Services.AdminIdentity` (`adminidentitydb`).

## Request Topology

```text
Browser ──► Davids.APIGateway (YARP + RS256 JWKS Validation + Confidential PKCE OIDC BFF + CSRF)
              ├── GET/HEAD /login, /login.css, /login.js, /favicon.svg (Anonymous)  ──► Davids.Frontend.Admin
              ├── GET /auth/login ──► /admin-identity/connect/authorize (PKCE S256) ──► Davids.Services.AdminIdentity
              ├── GET /signin-oidc (back-channel code + PKCE + client_secret)       ──► Davids.Services.AdminIdentity (/connect/token)
              ├── POST /auth/logout (RFC 7009 back-channel revocation + sign-out)   ──► Davids.Services.AdminIdentity (/connect/revocation)
              ├── GET/HEAD /{**remainder} (admin-frontend: AdminBffCookie/AdminBearer) ──► Davids.Frontend.Admin
              ├── /admin-identity/... (PathRemovePrefix: /admin-identity)            ──► Davids.Services.AdminIdentity (adminidentitydb)
              └── /customers/...                                                    ──► Davids.Services.Customers (customersdb)
```

- Administrator passwords are never entered into `Davids.Frontend.Admin`; `/login` initiates the Gateway OIDC BFF Authorization Code + PKCE (`S256`) redirect (`/auth/login`).
- YARP strips `Authorization`, `Cookie`, and `X-Auth-*` headers before forwarding requests to `frontend-admin`, injects verified `RS256` `Bearer` tokens on backend API calls, and sets `Cache-Control: no-store, no-cache, must-revalidate` on workspace responses.
- API calls from `wwwroot/app.js` use relative same-origin paths (`/admin-identity/...`, `/customers/...`, `/auth/logout`) with `credentials: "same-origin"` and `X-Requested-With: DavidsAdmin`.

## API Contracts Used by the Admin Web Frontend

| Operation | Gateway Route | Policy | Downstream Endpoint |
| --- | --- | --- | --- |
| Public SSO landing page | `GET /login` | `Anonymous` | `Davids.Frontend.Admin` (`login.html`) |
| Initiate OIDC PKCE login | `GET /auth/login?returnUrl=%2F` | `Anonymous` | Gateway OIDC BFF → `AdminIdentity` `/connect/authorize` |
| OIDC authorization callback | `GET /signin-oidc` | `Anonymous` (state + nonce + PKCE) | Gateway OIDC BFF → `AdminIdentity` `/connect/token` |
| Inspect BFF session | `GET /auth/session` | `Anonymous` | Handled by `Davids.APIGateway` |
| BFF sign-out & RFC 7009 revoke | `POST /auth/logout` | CSRF (`X-Requested-With: DavidsAdmin`) | Gateway OIDC BFF → `AdminIdentity` `/connect/revocation` |
| Verify current admin | `GET /admin-identity/me` | `customers-admin` | `Davids.Services.AdminIdentity` |
| List / provision admins | `GET /admin-identity/users`, `POST /admin-identity/users` | `customers-admin` | `Davids.Services.AdminIdentity` |
| Search & filter customers | `GET /customers?search=&state=&vip=` | `customers-admin` | `Davids.Services.Customers` |
| Inspect customer details | `GET /customers/{customerId}` | `resource-owner-or-admin` | `Davids.Services.Customers` |
| Edit customer details & state | `PUT /customers/{customerId}` | `customers-admin` | `Davids.Services.Customers` |
| Update customer state only | `PUT /customers/{customerId}/state/{state}` | `customers-admin` | `Davids.Services.Customers` |
