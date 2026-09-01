import { db } from "./index"
import { MIGRATIONS } from "./migration"

export async function initializeDatabase(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)

    const applied = await db.execute("SELECT name FROM schema_migrations")
    const appliedNames = new Set(applied.rows.map((row) => row.name as string))

    for (const migration of MIGRATIONS) {
      if (appliedNames.has(migration.name)) continue

      await db.batch(
        [
          ...migration.sql
            .split(";")
            .map((sql) => sql.trim())
            .filter(Boolean)
            .map((sql) => ({ sql, args: [] })),
          {
            sql: "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
            args: [migration.name, new Date().toISOString()],
          },
        ],
        "write"
      )
    }
  } catch (error) {
    console.error("Failed to initialize database:", error)
    throw error
  }
}
