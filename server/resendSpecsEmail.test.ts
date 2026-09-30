import { Resend } from "resend";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDashboardExportEmailHtml, buildSpecsEmailHtml, getResendSpecsEmailConfiguration } from "./resendSpecsEmail";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Specs email delivery", () => {
  it("reads the Resend key only from server environment configuration", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Tony Bianco Reports <reports@tonybianco.info>");
    vi.stubEnv("DISABLE_EMAIL", "false");

    expect(getResendSpecsEmailConfiguration()).toEqual({
      apiKey: "re_test_key",
      from: "Tony Bianco Reports <reports@tonybianco.info>",
      enabled: true,
    });
  });

  it("recognises the configured server secret as a valid full-access or sending-only key", async () => {
    const config = getResendSpecsEmailConfiguration();
    expect(config.enabled).toBe(true);

    const { data, error } = await new Resend(config.apiKey).domains.list();
    // A sending-only key is intentionally forbidden from this management
    // endpoint, but Resend's restricted_api_key response proves the token is
    // genuine and correctly scoped for the email send endpoint.
    if (error) {
      expect(error).toMatchObject({
        statusCode: 401,
        name: "restricted_api_key",
        message: "This API key is restricted to only send emails",
      });
      return;
    }

    expect(data).toBeDefined();

    const senderDomain = config.from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
    const configuredDomain = data?.data.find((domain) => domain.name.toLowerCase() === senderDomain);
    expect(configuredDomain?.status).toBe("verified");
  }, 15_000);

  it("keeps free-text email notes escaped inside the factory email", () => {
    const html = buildSpecsEmailHtml({
      style: "Cappa",
      last: "Cheeky/Cuba",
      category: "Ballet Flat",
      season: "Winter 27",
      message: "Use <latest> spec & confirm.",
    });

    expect(html).toContain("CAPPA");
    expect(html).toContain("Winter 27");
    expect(html).toContain("Use &lt;latest&gt; spec &amp; confirm.");
    expect(html).not.toContain("Use <latest> spec");
  });

  it("renders dashboard export scope and escapes free-text details", () => {
    const html = buildDashboardExportEmailHtml({
      exportType: "Buy Sheet",
      exportScope: "LA <Week 1>",
      season: "Winter 27",
      message: "Please use the <final> order & confirm.",
    });

    expect(html).toContain("Buy Sheet");
    expect(html).toContain("LA &lt;Week 1&gt;");
    expect(html).toContain("Please use the &lt;final&gt; order &amp; confirm.");
    expect(html).not.toContain("LA <Week 1>");
  });
});
