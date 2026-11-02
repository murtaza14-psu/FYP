/** Single place to rename the project and edit team details. Replace the placeholders. */
export const SITE = {
  name: 'GPU Cooling Advisor',
  tagline: 'Predict GPU heat. Compare cooling. Save water and power.',
  institution: 'Your University Name',
  department: 'Department of Computer Science',
  supervisor: 'Supervisor Name',
  contactEmail: 'team@example.com',
  address: 'Your University Name, Department of Computer Science, City, Country',
} as const

export interface NavLinkItem {
  to: string
  label: string
}

export const NAV_LINKS: readonly NavLinkItem[] = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/predict', label: 'Predict' },
  { to: '/results', label: 'Results' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

export interface TeamMember {
  name: string
  role: string
  email: string
}

export const TEAM: readonly TeamMember[] = [
  { name: 'Team Member One', role: 'Machine learning (heat prediction)', email: 'member1@example.com' },
  { name: 'Team Member Two', role: 'Cooling models (physics)', email: 'member2@example.com' },
  { name: 'Team Member Three', role: 'Web interface & ranking', email: 'member3@example.com' },
]
