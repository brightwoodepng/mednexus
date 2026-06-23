import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

let adminApp: App | null = null

export function getAdminDb() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) return null

  if (!adminApp) {
    adminApp =
      getApps().find((a) => a.name === "admin") ??
      initializeApp(
        { credential: cert({ projectId, clientEmail, privateKey }) },
        "admin",
      )
  }

  return getFirestore(adminApp)
}
