/**
 * URL validation utilities to prevent SSRF attacks.
 * Blocks requests to internal/private IP ranges.
 */
import { URL } from 'url';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve4);

const PRIVATE_IP_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 loopback
  /^fd[0-9a-f]{2}:/i,         // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
  /^localhost$/i,
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(pattern => pattern.test(ip));
}

/**
 * Validate a URL is safe for server-side requests (no SSRF).
 * Rejects internal IPs, localhost, and non-HTTP(S) schemes.
 */
export async function validateExternalUrl(urlString: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const parsed = new URL(urlString);

    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, error: `허용되지 않는 프로토콜: ${parsed.protocol}` };
    }

    // Check hostname directly
    if (isPrivateIP(parsed.hostname)) {
      return { safe: false, error: '내부 네트워크 주소는 허용되지 않습니다.' };
    }

    // DNS resolve to check actual IP
    try {
      const ips = await dnsResolve(parsed.hostname);
      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          return { safe: false, error: `호스트 ${parsed.hostname}이(가) 내부 IP(${ip})로 확인되어 차단되었습니다.` };
        }
      }
    } catch {
      // DNS resolution failed — hostname might be an IP directly
      if (isPrivateIP(parsed.hostname)) {
        return { safe: false, error: '내부 네트워크 주소는 허용되지 않습니다.' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, error: '유효하지 않은 URL 형식입니다.' };
  }
}

/**
 * Synchronous quick-check (no DNS resolution).
 * Use for initial validation before async full check.
 */
export function quickSsrfCheck(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (isPrivateIP(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
