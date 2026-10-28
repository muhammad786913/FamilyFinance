import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import { rateLimit } from "@/lib/rateLimit";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  // Do not override the session cookie name here. NextAuth (and its middleware)
  // decide the `__Secure-` prefix from whether NEXTAUTH_URL is HTTPS. Forcing the
  // prefix in NODE_ENV=production made local/HTTP deployments fail to authenticate
  // in middleware because it looked for the unprefixed cookie.
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password || "";
        const rl = rateLimit(`login:${email || "unknown"}`, { limit: 10, windowMs: 60_000 });
        if (!rl.ok) return null;
        if (!email || password.length < 8) return null;
        await connectDb();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user._id.toString(), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.email = token.email;
        session.user.name = token.name;
      }
      return session;
    },
  },
};

export { normalizeEmail };
