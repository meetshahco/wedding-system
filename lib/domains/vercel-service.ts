export interface VercelDomainConfig {
  configured: boolean;
  misconfigured?: boolean;
  recommendedValue?: string;
  type?: string;
  domainJson?: Record<string, unknown>;
}

export interface VercelApiOptions {
  token?: string;
  projectId?: string;
  teamId?: string;
  fetchFn?: typeof fetch;
}

export class VercelDomainService {
  private token: string;
  private projectId: string;
  private teamId?: string;
  private fetchFn: typeof fetch;

  constructor(options: VercelApiOptions = {}) {
    this.token = options.token || process.env.VERCEL_TOKEN || "";
    this.projectId = options.projectId || process.env.VERCEL_PROJECT_ID || "";
    this.teamId = options.teamId || process.env.VERCEL_TEAM_ID;
    this.fetchFn = options.fetchFn || fetch;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private appendTeam(url: string): string {
    if (!this.teamId) return url;
    const delimiter = url.includes("?") ? "&" : "?";
    return `${url}${delimiter}teamId=${this.teamId}`;
  }

  /**
   * Adds a custom domain to the Vercel project.
   */
  async addDomain(domain: string): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    const cleanDomain = domain.toLowerCase().trim();

    // If no Vercel token is configured, use local mock simulation
    if (!this.token || !this.projectId) {
      return {
        success: true,
        data: {
          name: cleanDomain,
          apexName: cleanDomain,
          verified: false,
          verification: [
            {
              type: "TXT",
              domain: `_vercel.${cleanDomain}`,
              value: `vc-domain-verify=${cleanDomain}-${Date.now()}`,
            },
          ],
        },
      };
    }

    try {
      const url = this.appendTeam(`https://api.vercel.com/v10/projects/${this.projectId}/domains`);
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ name: cleanDomain }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `Failed to add domain to Vercel (HTTP ${res.status})`,
        };
      }

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || "Network error contacting Vercel API" };
    }
  }

  /**
   * Queries domain DNS configuration recommendations from Vercel.
   */
  async getDomainConfig(domain: string): Promise<VercelDomainConfig> {
    const cleanDomain = domain.toLowerCase().trim();

    if (!this.token || !this.projectId) {
      // Mock simulation: default to CNAME cname.vercel-dns.com
      return {
        configured: true,
        recommendedValue: "cname.vercel-dns.com",
        type: "CNAME",
      };
    }

    try {
      const url = this.appendTeam(`https://api.vercel.com/v6/domains/${cleanDomain}/config`);
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      return {
        configured: Boolean(data?.configured),
        misconfigured: Boolean(data?.misconfigured),
        recommendedValue: data?.recommendedValue || "cname.vercel-dns.com",
        type: data?.type || "CNAME",
        domainJson: data,
      };
    } catch {
      return { configured: false, recommendedValue: "cname.vercel-dns.com", type: "CNAME" };
    }
  }

  /**
   * Triggers Vercel DNS verification handshake for a domain.
   */
  async verifyDomain(domain: string): Promise<{ verified: boolean; error?: string }> {
    const cleanDomain = domain.toLowerCase().trim();

    if (!this.token || !this.projectId) {
      // Mock simulation: automatically verifies in mock mode
      return { verified: true };
    }

    try {
      const url = this.appendTeam(`https://api.vercel.com/v9/projects/${this.projectId}/domains/${cleanDomain}/verify`);
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          verified: false,
          error: data?.error?.message || `DNS verification failed (HTTP ${res.status})`,
        };
      }

      return { verified: Boolean(data?.verified) };
    } catch (err: unknown) {
      return { verified: false, error: (err as Error).message || "Verification request failed" };
    }
  }

  /**
   * Removes a domain from the Vercel project.
   */
  async removeDomain(domain: string): Promise<{ success: boolean; error?: string }> {
    const cleanDomain = domain.toLowerCase().trim();

    if (!this.token || !this.projectId) {
      return { success: true };
    }

    try {
      const url = this.appendTeam(`https://api.vercel.com/v9/projects/${this.projectId}/domains/${cleanDomain}`);
      const res = await this.fetchFn(url, {
        method: "DELETE",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data?.error?.message || `Failed to remove domain (HTTP ${res.status})` };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message || "Remove request failed" };
    }
  }
}

export const vercelDomains = new VercelDomainService();

