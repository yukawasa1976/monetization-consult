import { sql } from "@vercel/postgres";
import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";

export function CustomPgAdapter(): Adapter {
  return {
    async createUser(user) {
      const result = await sql`
        INSERT INTO auth_users (name, email, "emailVerified", image)
        VALUES (${user.name ?? null}, ${user.email}, ${user.emailVerified?.toISOString() ?? null}, ${user.image ?? null})
        RETURNING id, name, email, "emailVerified", image
      `;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
        image: row.image,
      } as AdapterUser;
    },

    async getUser(id) {
      const result = await sql`SELECT id, name, email, "emailVerified", image FROM auth_users WHERE id = ${id}`;
      if (!result.rows[0]) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
        image: row.image,
      } as AdapterUser;
    },

    async getUserByEmail(email) {
      const result = await sql`SELECT id, name, email, "emailVerified", image FROM auth_users WHERE email = ${email}`;
      if (!result.rows[0]) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
        image: row.image,
      } as AdapterUser;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const result = await sql`
        SELECT u.id, u.name, u.email, u."emailVerified", u.image
        FROM auth_users u
        JOIN auth_accounts a ON a."userId" = u.id
        WHERE a.provider = ${provider} AND a."providerAccountId" = ${providerAccountId}
      `;
      if (!result.rows[0]) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
        image: row.image,
      } as AdapterUser;
    },

    async updateUser(user) {
      const result = await sql`
        UPDATE auth_users
        SET name = COALESCE(${user.name ?? null}, name),
            email = COALESCE(${user.email ?? null}, email),
            image = COALESCE(${user.image ?? null}, image)
        WHERE id = ${user.id!}
        RETURNING id, name, email, "emailVerified", image
      `;
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
        image: row.image,
      } as AdapterUser;
    },

    async linkAccount(account) {
      await sql`
        INSERT INTO auth_accounts (
          "userId", type, provider, "providerAccountId",
          refresh_token, access_token, expires_at,
          token_type, scope, id_token, session_state
        )
        VALUES (
          ${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId},
          ${account.refresh_token ?? null}, ${account.access_token ?? null}, ${account.expires_at ?? null},
          ${account.token_type ?? null}, ${account.scope ?? null}, ${account.id_token ?? null}, ${account.session_state != null ? String(account.session_state) : null}
        )
      `;
      return account as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await sql`
        DELETE FROM auth_accounts
        WHERE provider = ${provider} AND "providerAccountId" = ${providerAccountId}
      `;
    },

    // JWT戦略のため、DB session系メソッドは不要だがインターフェース上定義
    async createSession() {
      throw new Error("JWT strategy - no DB sessions");
    },
    async getSessionAndUser() {
      return null;
    },
    async updateSession() {
      return null;
    },
    async deleteSession() {},
  };
}
