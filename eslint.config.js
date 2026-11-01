import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default [
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "supabase/functions/**/deno.json"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
