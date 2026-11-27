import { dateIn } from '#scripts/screenshots/seed/proposalSeeds.ts'

/** Findings the review proposal names as sharing its cause, by CVE on the same nginx image */
export const REVIEW_RELATED = ['CVE-2099-30088', 'CVE-2099-18806'] as const

/** Arguments of the open Auto-check proposal the review shot shows, without findingId */
export const REVIEW_PROPOSAL: Record<string, unknown> = {
  verdict: 'needs_patch',
  confidence: 'high',
  summary:
    'nginx 1.27.2-alpine ships libcrypto3 3.3.2-r0, which has the SM2 out-of-bounds read. The image rebuilt on alpine:3.20.4 carries the fixed 3.3.3-r0.',
  presence: 'libcrypto3 3.3.2-r0 in /lib, loaded by the nginx binary.',
  reachability:
    'The read happens while decrypting SM2 data, which nginx reaches through TLS with SM2 certificates only.',
  exposure: 'Public storefront ingress; the docs and wiki workloads use the same image.',
  fix: {
    action: 'base image: rebuild on alpine:3.20.4 (libcrypto3 3.3.3-r0)',
    layer: 'base_image',
    fixedVersion: '3.3.3-r0',
    availability: 'available',
    change:
      '1. Pull nginx:1.27.2-alpine again, the official image is rebuilt on alpine:3.20.4.\n2. Pin the new digest in the storefront, docs and wiki Helm values.\n3. Roll out and confirm with apk info -v libcrypto3 in one pod: 3.3.3-r0.',
    effort: 'Pull and roll out, about 15 minutes, no code change',
  },
  review: { date: dateIn(30), why: 'confirm the rollout reached every namespace' },
  evidence: [
    {
      check: 'installed version',
      method: 'apk info -v libcrypto3 in the exported image',
      result: '3.3.2-r0',
    },
    { check: 'fixed version', method: 'Alpine secdb for v3.20', result: 'fixed in 3.3.3-r0' },
    {
      check: 'SM2 certificates',
      method: 'nginx.conf and ssl_certificate files',
      result: 'ECDSA and RSA only',
    },
    { check: 'OpenSSL SM2 providers', method: 'grep -r sm2 /etc/ssl', result: 'no match' },
  ],
  evidenceBasis: ['advisory', 'image'],
  unknowns: ['runtime TLS settings of the wiki ingress, not part of the image'],
  references: [
    'https://security.alpinelinux.org/vuln/CVE-2099-91600',
    'https://pkgs.alpinelinux.org/package/v3.20/main/x86_64/libcrypto3',
  ],
  relatedReason: 'The same libcrypto3 3.3.2-r0 in nginx, fixed by the same rebuild.',
  agent: 'Claude Code',
}
