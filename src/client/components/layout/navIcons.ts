import type { IconName } from '@/components/icons/iconPaths'
import type { NavIcon } from '@/router/navItems'

export const NAV_ICONS: Record<NavIcon, IconName> = {
  triage: 'triage',
  inbox: 'inbox',
  images: 'images',
  cves: 'cves',
  decisions: 'decisions',
  checks: 'auto-check',
}
