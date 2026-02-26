import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeRole = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Clean up previous role listener
      if (unsubscribeRole) {
        unsubscribeRole()
        unsubscribeRole = null
      }

      if (currentUser) {
        setUser(currentUser)

        // Use onSnapshot so role updates in real-time (fixes signup race condition)
        unsubscribeRole = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              const role = snapshot.data().role
              setUserRole(role)
            } else {
              // Doc not yet created — keep waiting, don't default to patient
              setUserRole(null)
            }
            setLoading(false)
          },
          (error) => {
            console.error('Role fetch error:', error)
            setUserRole(null)
            setLoading(false)
          }
        )
      } else {
        setUser(null)
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeRole) unsubscribeRole()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}