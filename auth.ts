import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { CustomPgAdapter } from "@/app/lib/auth-adapter";

const adapter = CustomPgAdapter();

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.userId = user.id;
        // Googleプロフィール画像を取得（profileはGoogleの生レスポンス）
        const picture = (profile as { picture?: string })?.picture ?? user.image;
        token.picture = picture;
        // DBの画像も更新
        if (picture && user.id) {
          try {
            await adapter.updateUser!({ id: user.id, image: picture });
          } catch {}
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
