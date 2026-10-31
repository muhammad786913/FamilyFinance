import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import { rateLimit, resetLimit } from "@/lib/rateLimit";
import { passwordFitsBcrypt } from "@/lib/passwordPolicy";

// A real bcrypt hash of a random value, used to keep failed-login timing flat.
const DUMMY_HASH = "$2a$12$EtybtyZBmSwtZrh0LOQ8Q.uf2lyyk1FNH6AOKuW4r3mhhmhTue5/2";

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
      credentials: { email: {}, password: {}, website: {} },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password || "";
        // Honeypot field from the login form: bots fill it, people do not.
        if (String(credentials?.website || "").trim()) return null;
        const rl = rateLimit(`login:${email || "unknown"}`, {
          limit: 10,
          windowMs: 60_000,
          banMs: 60_000,
        });
        if (!rl.ok) return null;
        if (!email || password.length < 8) return null;
        if (!passwordFitsBcrypt(password)) return null;
        await connectDb();
        const user = await User.findOne({ email }).select("+passwordHash");
        // Always run a bcrypt comparison so a missing account does not answer faster.
        const hash = user?.passwordHash || DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);
        if (!user || !user.passwordHash || !ok) return null;
        if (!user.emailVerifiedAt) {
          // Correct password, but the mailbox has not been confirmed yet.
          const err = new Error("EmailNotVerified");
          err.name = "EmailNotVerified";
          throw err;
        }
        resetLimit(`login:${email}`);
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
