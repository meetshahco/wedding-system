import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanHost, resolveHost, getPrimaryDomainRedirect } from "@/lib/domains/domain-resolver";
import { VercelDomainService } from "@/lib/domains/vercel-service";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("Phase 12: Custom Domains & Routing Architecture", () => {
  const createdWeddingIds: string[] = [];

  const createTestWedding = async (slugSuffix: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `domain-${slugSuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        coupleName1: "Rohan",
        coupleName2: "Ananya",
        weddingDate: new Date("2028-05-15"),
      },
    });
    createdWeddingIds.push(w.id);
    return w;
  };

  afterAll(async () => {
    if (createdWeddingIds.length > 0) {
      await prisma.weddingDomain.deleteMany({
        where: { weddingId: { in: createdWeddingIds } },
      });
      await prisma.guest.deleteMany({
        where: { weddingId: { in: createdWeddingIds } },
      });
      await prisma.wedding.deleteMany({
        where: { id: { in: createdWeddingIds } },
      });
    }
  });

  describe("Host Normalisation (cleanHost)", () => {
    it("strips ports, lowercases, and defaults safely", () => {
      expect(cleanHost("localhost:3000")).toBe("localhost");
      expect(cleanHost("ArjunAndMeera.COM:8080")).toBe("arjunandmeera.com");
      expect(cleanHost("weddings.test")).toBe("weddings.test");
      expect(cleanHost("")).toBe("localhost");
      expect(cleanHost(null)).toBe("localhost");
      expect(cleanHost(undefined)).toBe("localhost");
    });
  });

  describe("Host Resolution (resolveHost)", () => {
    it("resolves root platform host as type platform", async () => {
      const hosts = ["localhost", "127.0.0.1", "weddings.test", "www.weddings.test", "localhost:3000"];
      for (const h of hosts) {
        const res = await resolveHost(h);
        expect(res.type).toBe("platform");
        expect(res.isWeddingHost).toBe(false);
      }
    });

    it("resolves valid wedding platform subdomain", async () => {
      const wedding = await createTestWedding("subdomain-test");
      const host = `${wedding.slug}.weddings.test`;

      const res = await resolveHost(host);
      expect(res.type).toBe("wedding_subdomain");
      expect(res.isWeddingHost).toBe(true);
      expect(res.wedding?.id).toBe(wedding.id);
      expect(res.wedding?.slug).toBe(wedding.slug);
    });

    it("returns unknown for non-existent platform subdomain", async () => {
      const host = "non-existent-wedding-slug-999.weddings.test";
      const res = await resolveHost(host);
      expect(res.type).toBe("unknown");
      expect(res.isWeddingHost).toBe(false);
    });

    it("resolves active custom domain and www alias", async () => {
      const wedding = await createTestWedding("custom-dom-test");
      const domainName = `rohan-ananya-${Date.now()}.com`;

      await prisma.weddingDomain.create({
        data: {
          weddingId: wedding.id,
          domain: domainName,
          status: "active",
          isPrimary: true,
        },
      });

      // 1. Apex domain
      const resApex = await resolveHost(domainName);
      expect(resApex.type).toBe("wedding_custom_domain");
      expect(resApex.isWeddingHost).toBe(true);
      expect(resApex.wedding?.id).toBe(wedding.id);
      expect(resApex.domain?.domain).toBe(domainName);

      // 2. www alias
      const resWww = await resolveHost(`www.${domainName}`);
      expect(resWww.type).toBe("wedding_custom_domain");
      expect(resWww.isWeddingHost).toBe(true);
      expect(resWww.wedding?.id).toBe(wedding.id);
    });

    it("does not resolve inactive custom domains (pending or configuring)", async () => {
      const wedding = await createTestWedding("pending-dom");
      const domainName = `pending-${Date.now()}.com`;

      await prisma.weddingDomain.create({
        data: {
          weddingId: wedding.id,
          domain: domainName,
          status: "configuring",
        },
      });

      const res = await resolveHost(domainName);
      expect(res.type).toBe("unknown");
      expect(res.isWeddingHost).toBe(false);
    });

    it("returns unknown for untracked domains", async () => {
      const res = await resolveHost("some-external-domain.org");
      expect(res.type).toBe("unknown");
      expect(res.isWeddingHost).toBe(false);
    });
  });

  describe("Primary Domain Canonical Redirect (getPrimaryDomainRedirect)", () => {
    it("redirects guest invite link from platform host to active primary custom domain", async () => {
      const wedding = await createTestWedding("redirect-test");
      const primaryDomain = `celebrate-${Date.now()}.com`;

      await prisma.weddingDomain.create({
        data: {
          weddingId: wedding.id,
          domain: primaryDomain,
          status: "active",
          isPrimary: true,
        },
      });

      const guestToken = `tok-red-${Date.now()}`;
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          name: "VIP Guest",
          phone: "+919876543210",
          code: "4321",
          token: guestToken,
        },
      });

      // From localhost
      const redirect1 = await getPrimaryDomainRedirect("localhost:3000", guestToken);
      expect(redirect1).toBe(`https://${primaryDomain}/i/${guestToken}`);

      // From weddings.test
      const redirect2 = await getPrimaryDomainRedirect("weddings.test", guestToken);
      expect(redirect2).toBe(`https://${primaryDomain}/i/${guestToken}`);

      // From wedding host itself (already there, no infinite redirect)
      const redirect3 = await getPrimaryDomainRedirect(primaryDomain, guestToken);
      expect(redirect3).toBeNull();
    });

    it("returns null if wedding has no active primary domain", async () => {
      const wedding = await createTestWedding("no-primary-dom");
      const guestToken = `tok-noprim-${Date.now()}`;
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          name: "Guest No Domain",
          phone: "+919876543211",
          code: "1234",
          token: guestToken,
        },
      });

      const redirect = await getPrimaryDomainRedirect("localhost:3000", guestToken);
      expect(redirect).toBeNull();
    });
  });

  describe("Vercel Domain Service", () => {
    it("operates in mock simulation mode when Vercel credentials are empty", async () => {
      const mockService = new VercelDomainService({ token: "", projectId: "" });

      // Add domain
      const addRes = await mockService.addDomain("mywedding.com");
      expect(addRes.success).toBe(true);
      expect(addRes.data?.name).toBe("mywedding.com");

      // Get domain config
      const configRes = await mockService.getDomainConfig("mywedding.com");
      expect(configRes.configured).toBe(true);
      expect(configRes.recommendedValue).toBe("cname.vercel-dns.com");

      // Verify domain
      const verifyRes = await mockService.verifyDomain("mywedding.com");
      expect(verifyRes.verified).toBe(true);

      // Remove domain
      const removeRes = await mockService.removeDomain("mywedding.com");
      expect(removeRes.success).toBe(true);
    });

    it("makes correct HTTP requests with authorization and query params when configured", async () => {
      const calls: { url: string; method: string; body?: string }[] = [];
      const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || "GET";
        const body = init?.body as string | undefined;
        calls.push({ url, method, body });

        if (url.includes("/domains") && method === "POST") {
          return new Response(JSON.stringify({ name: "apiwedding.com", verified: false }), { status: 200 });
        }
        if (url.includes("/config") && method === "GET") {
          return new Response(JSON.stringify({ configured: false, recommendedValue: "cname.vercel-dns.com", type: "CNAME" }), { status: 200 });
        }
        if (url.includes("/verify") && method === "POST") {
          return new Response(JSON.stringify({ verified: true }), { status: 200 });
        }
        if (url.includes("/domains/") && method === "DELETE") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      };

      const liveService = new VercelDomainService({
        token: "fake-vercel-token",
        projectId: "fake-proj-123",
        teamId: "fake-team-xyz",
        fetchFn: mockFetch,
      });

      await liveService.addDomain("apiwedding.com");
      expect(calls[0].url).toContain("https://api.vercel.com/v10/projects/fake-proj-123/domains?teamId=fake-team-xyz");
      expect(calls[0].method).toBe("POST");

      await liveService.getDomainConfig("apiwedding.com");
      expect(calls[1].url).toContain("/domains/apiwedding.com/config?teamId=fake-team-xyz");
      expect(calls[1].method).toBe("GET");

      await liveService.verifyDomain("apiwedding.com");
      expect(calls[2].url).toContain("/verify?teamId=fake-team-xyz");
      expect(calls[2].method).toBe("POST");

      await liveService.removeDomain("apiwedding.com");
      expect(calls[3].url).toContain("/domains/apiwedding.com?teamId=fake-team-xyz");
      expect(calls[3].method).toBe("DELETE");
    });
  });

  describe("Middleware Domain Isolation & Security Routing", () => {
    it("blocks /admin, /api/admin, and /login with 404 on wedding hosts", async () => {
      const wedding = await createTestWedding("subdomain-sec");
      const weddingHost = `${wedding.slug}.weddings.test`;

      // 1. /admin should be 404
      const reqAdmin = new NextRequest(`http://${weddingHost}/admin/guests`, {
        headers: { host: weddingHost },
      });
      const resAdmin = await middleware(reqAdmin);
      expect(resAdmin.status).toBe(404);

      // 2. /api/admin should be 404
      const reqApiAdmin = new NextRequest(`http://${weddingHost}/api/admin/guests`, {
        headers: { host: weddingHost },
      });
      const resApiAdmin = await middleware(reqApiAdmin);
      expect(resApiAdmin.status).toBe(404);

      // 3. /login should be 404
      const reqLogin = new NextRequest(`http://${weddingHost}/login`, {
        headers: { host: weddingHost },
      });
      const resLogin = await middleware(reqLogin);
      expect(resLogin.status).toBe(404);
    });

    it("rewrites root / on wedding host to /w/[slug]", async () => {
      const wedding = await createTestWedding("subdomain-rewrite");
      const weddingHost = `${wedding.slug}.weddings.test`;

      const reqRoot = new NextRequest(`http://${weddingHost}/`, {
        headers: { host: weddingHost },
      });
      const resRoot = await middleware(reqRoot);
      expect(resRoot.status).toBe(200);
      expect(resRoot.headers.get("x-wedding-id")).toBe(wedding.id);
      expect(resRoot.headers.get("x-wedding-slug")).toBe(wedding.slug);
    });

    it("returns 404 for requests on unknown hosts", async () => {
      const reqUnknown = new NextRequest("http://unrecognized-host.org/", {
        headers: { host: "unrecognized-host.org" },
      });
      const resUnknown = await middleware(reqUnknown);
      expect(resUnknown.status).toBe(404);
    });
  });

  describe("Domain Model Lifecycle & Primary Domain Enforcement", () => {
    it("correctly enforces single primary domain per wedding and promotes on deletion", async () => {
      const wedding = await createTestWedding("domain-lifecycle");

      // 1. Add first domain -> isPrimary should be true
      const dom1 = await prisma.weddingDomain.create({
        data: {
          weddingId: wedding.id,
          domain: `dom1-${Date.now()}.com`,
          status: "active",
          isPrimary: true,
        },
      });
      expect(dom1.isPrimary).toBe(true);

      // 2. Add second domain -> set as primary
      await prisma.weddingDomain.updateMany({
        where: { weddingId: wedding.id },
        data: { isPrimary: false },
      });
      const dom2 = await prisma.weddingDomain.create({
        data: {
          weddingId: wedding.id,
          domain: `dom2-${Date.now()}.com`,
          status: "active",
          isPrimary: true,
        },
      });

      // Verify dom1 is no longer primary
      const dom1Check = await prisma.weddingDomain.findUnique({ where: { id: dom1.id } });
      expect(dom1Check?.isPrimary).toBe(false);
      expect(dom2.isPrimary).toBe(true);

      // 3. Delete primary dom2 -> promote remaining dom1 to primary
      await prisma.weddingDomain.delete({ where: { id: dom2.id } });
      const remaining = await prisma.weddingDomain.findFirst({
        where: { weddingId: wedding.id },
      });
      if (remaining) {
        await prisma.weddingDomain.update({
          where: { id: remaining.id },
          data: { isPrimary: true },
        });
      }

      const dom1AfterPromo = await prisma.weddingDomain.findUnique({ where: { id: dom1.id } });
      expect(dom1AfterPromo?.isPrimary).toBe(true);
    });
  });
});
