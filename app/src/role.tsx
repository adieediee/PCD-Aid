import { createContext, useContext, useState, type ReactNode } from 'react'
import type { RoleId } from './types'

// Prototype-only role switcher (header). Real auth is out of scope.
const RoleContext = createContext<{ role: RoleId; setRole: (r: RoleId) => void }>({
  role: 'vojtech',
  setRole: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<RoleId>('vojtech')
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
}

export const useRole = () => useContext(RoleContext)
