import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Database-backed tests use a private in-memory database.
    env: { DATABASE_URL: ":memory:", DATABASE_AUTH_TOKEN: "" },
  },
})
