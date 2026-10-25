export const pagePaths = {
  dashboard: '/',
  results: '/journey-results',
  review: '/route-review',
  classes: '/train-selection',
  passengerDetails: '/passenger-details',
  payment: '/demo-payment',
  confirmation: '/booking-confirmation',
  tickets: '/my-tickets',
  passengers: '/saved-passengers',
  ledger: '/ledger-refunds',
  lab: '/route-lab',
  disruption: '/disruption-simulator',
  evaluation: '/evaluation-reports',
} as const

export type AppPage = keyof typeof pagePaths
const pageForPath: Record<string, AppPage> = Object.fromEntries(
  Object.entries(pagePaths).map(([page, path]) => [path, page as AppPage]),
)
Object.assign(pageForPath, {
  '/journey-planner': 'dashboard',
  '/journey-planner/select-train': 'classes',
  '/journey-planner/passenger-details': 'passengerDetails',
})

export function pageFromPath(pathname: string): AppPage {
  return pageForPath[pathname.replace(/\/$/, '') || '/'] ?? 'dashboard'
}
