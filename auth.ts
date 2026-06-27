import { chunk } from "stunk";
import { withPersistence } from "stunk/middleware"

import { AuthState } from "@/types"

export const authStore = withPersistence(chunk<AuthState>({
  isLoading: false,
  user: null,
  ninUser: null,
  result: null
}), { key: "auth-state" })


export const logout = () => {
  authStore.reset()
}
