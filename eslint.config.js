import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default [
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Edge Functions lidam com JSON externo sem tipo (provedores, Graph API, supabase-js sem types gerados).
  { files: ["supabase/functions/**/*.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  { files: ["apps/painel/public/sw.js"], languageOptions: { globals: { self: "readonly", URL: "readonly" } } },
];
