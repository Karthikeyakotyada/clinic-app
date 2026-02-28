import { createContext, useContext, useState } from 'react'

const SidebarContext = createContext({ open: true, toggle: () => { } })

export function SidebarProvider({ children }) {
    const [open, setOpen] = useState(true)
    const toggle = () => setOpen(prev => !prev)
    return (
        <SidebarContext.Provider value={{ open, toggle }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    return useContext(SidebarContext)
}
