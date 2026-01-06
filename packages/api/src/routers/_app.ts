import { router } from '../trpc'
import { authRouter } from './auth'
import { userRouter } from './user'
import { storageRouter } from './storage'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  storage: storageRouter,
})

export type AppRouter = typeof appRouter
