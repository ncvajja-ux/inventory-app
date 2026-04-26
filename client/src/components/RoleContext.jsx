import { createContext, useContext } from 'react'

export const RoleContext = createContext('sales')

export function useRole() {
  return useContext(RoleContext)
}
