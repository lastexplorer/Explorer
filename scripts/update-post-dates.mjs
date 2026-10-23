import { execSync } from "child_process";
import fs from "fs";
import path from "path";

try {
  const staged = execSync("git diff --cached --name-status", {
    encoding: "utf-8",
  }).trim();
  if (!staged) process.exit(0);

  const lines = staged.split(/\r?\n/);
  const now = new Date().toISOString();

  for (const line of lines) {
    const [status, rawFile] = line.trim().split(/\s+/);
    if (!rawFile) continue;
    const filePath = rawFile.replace(/\\/g, "/");

    // Only process markdown files inside src/content/posts
    if (
      !filePath.startsWith("src/content/posts/") ||
      (!filePath.endsWith(".md") && !filePath.endsWith(".mdx"))
    ) {
      continue;
    }

    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf-8");
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    let fm = fmMatch[1];
    let changed = false;

    if (status === "M") {
      // Check if draft: true (skip if explicitly a draft)
      if (/\bdraft:\s*true\b/.test(fm)) continue;

      if (/^modDatetime:/m.test(fm)) {
        fm = fm.replace(/^modDatetime:.*$/m, `modDatetime: ${now}`);
        changed = true;
      } else if (/^pubDatetime:/m.test(fm)) {
        fm = fm.replace(/^pubDatetime:(.*)$/m, `pubDatetime:$1\nmodDatetime: ${now}`);
        changed = true;
      }
    } else if (status === "A") {
      if (/^pubDatetime:\s*$/m.test(fm)) {
        fm = fm.replace(/^pubDatetime:.*$/m, `pubDatetime: ${now}`);
        changed = true;
      }
    }

    if (changed) {
      const newContent = content.replace(
        /^---\r?\n[\s\S]*?\r?\n---/,
        `---\n${fm.trim()}\n---`
      );
      fs.writeFileSync(filePath, newContent, "utf-8");
      execSync(`git add "${filePath}"`);
      console.log(`[git-hook] Auto-updated timestamp for: ${filePath}`);
    }
  }
} catch (err) {
  console.error("[git-hook] Error updating post dates:", err);
  // Don't block commit if hook fails
  process.exit(0);
}
