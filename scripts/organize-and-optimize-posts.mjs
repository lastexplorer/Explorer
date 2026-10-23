import fs from "fs";
import path from "path";

const baseDir = "C:/Users/Fortress/.gemini/antigravity/scratch/Explorer";
const postsDir = path.join(baseDir, "src/content/posts");
const targetDir = path.join(postsDir, "2026");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(postsDir).filter(f => f.endsWith(".md") || f.endsWith(".mdx"));

for (const file of files) {
  const oldPath = path.join(postsDir, file);
  const newPath = path.join(targetDir, file);

  let content = fs.readFileSync(oldPath, "utf8");

  // Ensure modDatetime is present
  const now = "2026-10-23T17:40:00.000Z";
  if (!/^modDatetime:/m.test(content)) {
    content = content.replace(/(pubDatetime:.*)/, `$1\nmodDatetime: ${now}`);
  }

  // Optimize redundant H1 directly following frontmatter
  // Astro already renders frontmatter title as H1
  content = content.replace(/(---\r?\n\r?\n)# [^\r\n]+\r?\n+/, "$1");

  fs.writeFileSync(newPath, content, "utf8");
  fs.unlinkSync(oldPath);
  console.log(`Organized: ${file} -> 2026/${file}`);
}
