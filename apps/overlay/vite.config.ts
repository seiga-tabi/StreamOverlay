import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? (command === "build" ? "/overlay/" : "/"),
  plugins: [react()],
  server: { port: 5174 }
}));
