import { router } from '../trpc'
import { authRouter } from './auth'
import { userRouter } from './user'
import { storageRouter } from './storage'
import { creditsRouter } from './credits'
import { generationRouter } from './generation'
import { analyticsRouter } from './analytics'
import { rolesRouter } from './roles'
import { merchantRouter } from './merchant'
import { bodyProfileRouter } from './body-profile'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  storage: storageRouter,
  credits: creditsRouter,
  generation: generationRouter,
  analytics: analyticsRouter,
  roles: rolesRouter,
  merchant: merchantRouter,
  bodyProfile: bodyProfileRouter,
})

export type AppRouter = typeof appRouter
