import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@vizualizer/tokens"],
  devIndicators: false,
  agentRules: false,
};
export default config;
