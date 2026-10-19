import { useEffect } from 'react'
import { SITE } from '../config/site'

/** Sets document.title. With no title, uses the home-page form "Name · Tagline". */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} · ${SITE.tagline}`
  }, [title])
}
