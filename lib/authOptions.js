import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import { rateLimit, resetLimit } from "@/lib/rateLimit";
import { passwordFitsBcrypt } from "@/lib/passwordPolicy";

const DUMMY_HASH = "$2a$12$EtybtyZBmSwtZrh0LOQ8Q.uf2lyyk1FNH6AOKuW4r3mhhmhTue5/2";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: {}, password: {}, website: {} },

      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password || "";

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

        const hash = user?.passwordHash || DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);

        if (!user || !user.passwordHash || !ok) return null;

        resetLimit(`login:${email}`);

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        };
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