using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Davids.Frontend.Admin.Tests;

[Trait("Category", "Integration")]
public sealed class AdminFrontendTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public AdminFrontendTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    [Fact]
    public async Task ServesAdminWorkspaceAndPublicOidcLoginShellWithHardenedHeaders()
    {
        using var client = factory.CreateClient();

        using var workspaceResponse = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, workspaceResponse.StatusCode);
        Assert.Equal("text/html", workspaceResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", workspaceResponse.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", workspaceResponse.Headers.GetValues("X-Frame-Options").Single());

        var csp = workspaceResponse.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("default-src 'self'", csp);
        Assert.Contains("script-src 'self'", csp);

        var workspaceHtml = await workspaceResponse.Content.ReadAsStringAsync();
        Assert.Contains("Customer Directory", workspaceHtml);
        Assert.Contains("Edit customer", workspaceHtml);
        Assert.Contains("Administrators", workspaceHtml);
        Assert.Contains("Administrator login attempts", workspaceHtml);
        Assert.DoesNotContain("Sign Up", workspaceHtml);
        Assert.DoesNotContain("/identity/", workspaceHtml, StringComparison.OrdinalIgnoreCase);

        using var loginResponse = await client.GetAsync("/login");
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginHtml = await loginResponse.Content.ReadAsStringAsync();
        Assert.Contains("Administrator Single Sign-On", loginHtml);
        Assert.Contains("Continue with Admin OIDC", loginHtml);
        Assert.DoesNotContain("type=\"password\"", loginHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Create account", loginHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("/app.css", "text/css")]
    [InlineData("/login.css", "text/css")]
    [InlineData("/app.js", "text/javascript")]
    [InlineData("/login.js", "text/javascript")]
    [InlineData("/favicon.svg", "image/svg+xml")]
    public async Task ServesStaticAssetsAndExposesHealthChecks(string assetPath, string expectedMediaType)
    {
        using var client = factory.CreateClient();

        using var asset = await client.GetAsync(assetPath);
        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.Equal(expectedMediaType, asset.Content.Headers.ContentType?.MediaType);

        if (assetPath.EndsWith(".js", StringComparison.Ordinal))
        {
            var script = await asset.Content.ReadAsStringAsync();
            Assert.DoesNotContain("localStorage", script, StringComparison.Ordinal);
            Assert.DoesNotContain("sessionStorage", script, StringComparison.Ordinal);
            Assert.DoesNotContain("/identity/", script, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("/sign-in", script, StringComparison.OrdinalIgnoreCase);
        }

        if (assetPath == "/login.js")
        {
            var loginScript = await asset.Content.ReadAsStringAsync();
            Assert.Contains("/auth/login", loginScript, StringComparison.Ordinal);
            Assert.Contains("/auth/session", loginScript, StringComparison.Ordinal);
        }

        if (assetPath == "/app.js")
        {
            var appScript = await asset.Content.ReadAsStringAsync();
            Assert.Contains("X-Requested-With", appScript, StringComparison.Ordinal);
            Assert.Contains("/auth/logout", appScript, StringComparison.Ordinal);
            Assert.Contains("/admin-identity/me", appScript, StringComparison.Ordinal);
            Assert.Contains("/admin-identity/me/password", appScript, StringComparison.Ordinal);
            Assert.Contains("/admin-identity/login-audits", appScript, StringComparison.Ordinal);
            Assert.Contains("/admin-identity/change-audits", appScript, StringComparison.Ordinal);
            Assert.Contains("/customer-accounts/change-audits", appScript, StringComparison.Ordinal);
            Assert.Contains("/customers/change-audits", appScript, StringComparison.Ordinal);
            Assert.Contains("/customers?", appScript, StringComparison.Ordinal);
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/alive")).StatusCode);
    }

    [Theory]
    [InlineData("/directory")]
    [InlineData("/admins")]
    [InlineData("/audits")]
    public async Task ClientSideWorkspaceRoutesServeIndexShellWithNoStoreCacheControl(string path)
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? string.Empty);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("Customer Directory", html);
    }
}
