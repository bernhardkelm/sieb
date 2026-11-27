import type { NavIcon } from '@/router/navItems'

/** Path data per nav icon on a 16 by 16 grid, drawn as 1.4 strokes like the other icons */
export const NAV_ICON_PATHS: Record<NavIcon, string[]> = {
  triage: ['M2.5 3h11L9.25 8v4.5l-2.5 1.5V8z'],
  inbox: ['M2.5 9.5 4.5 3h7l2 6.5V13h-11z', 'M2.5 9.5h3l1 1.5h3l1-1.5h3'],
  images: ['M8 1.75l5.5 3v6.5L8 14.25l-5.5-3v-6.5z', 'M2.5 4.75 8 7.75l5.5-3M8 7.75v6.5'],
  cves: [
    'M8 1.75 13 3.5v4c0 3.1-2.1 5.6-5 6.75-2.9-1.15-5-3.65-5-6.75v-4z',
    'M8 5v3.5M8 10.75v.25',
  ],
  decisions: ['M2.5 4.5l1.25 1.25L6 3.5M2.5 10.5l1.25 1.25L6 9.5', 'M8.5 4.5h5M8.5 10.5h5'],
  checks: ['M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z', 'M10.5 10.5 14 14M5 7l1.5 1.5L9.5 5.5'],
}
