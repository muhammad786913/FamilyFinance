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
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
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
        const user = await User.findOne({ email }).select("+passwordHash name email");
        if (!user) return null;
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
