import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // email is only unique per-tenant (@@unique([tenant_id, email])), so the same
        // address can exist in multiple orgs with different passwords/status. Check every
        // matching row rather than an arbitrary findFirst so login resolves to whichever
        // account the supplied password actually belongs to.
        const candidates = await prisma.user.findMany({
          where: { email },
          include: { tenant: { select: { status: true } } },
        });

        let user: (typeof candidates)[number] | null = null;
        for (const candidate of candidates) {
          if (candidate.password_hash && bcrypt.compareSync(password, candidate.password_hash)) {
            user = candidate;
            break;
          }
        }

        if (!user) {
          return null;
        }

        if (user.status === "Disabled") {
          throw new Error("Your account has been disabled.");
        }
        if (user.status === "Unverified") {
          throw new Error("Your account has not been activated yet.");
        }
        if (user.tenant?.status === "Disabled") {
          throw new Error("Your organization's access has been disabled.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
        };
      },
    }),
  ],
});
