import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Hasło', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const profile = await prisma.profile.findUnique({
          where: { email: credentials.email },
        })
        if (!profile) return null

        const isValid = await bcrypt.compare(credentials.password, profile.password)
        if (!isValid) return null

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          role: profile.role,
          avatar_url: profile.avatar_url,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.avatar_url = (user as { avatar_url: string | null }).avatar_url
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string
        ;(session.user as { role: string }).role = token.role as string
        ;(session.user as { avatar_url: string | null }).avatar_url = token.avatar_url as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
