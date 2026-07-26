import "dotenv/config";

// // Provide a minimal declaration for `process` to satisfy TypeScript
// declare const process: { env: { [key: string]: string | undefined } };
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});