import { boot } from "@/main";

boot().catch((err) => {
  console.error("Failed to boot server:", err);
  process.exit(1);
});
