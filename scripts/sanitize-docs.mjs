import fs from "fs";
import path from "path";

// 1. Sanitize Desktop folder
const desktopFolder = "C:/Users/Fortress/Desktop/cloudflare技术文档";
const repoFolder = "C:/Users/Fortress/.gemini/antigravity/scratch/Explorer/src/content/posts/2026";

function sanitizeContent(content) {
  let res = content;

  // 1. Tailnet Domain
  res = res.replace(/wsl-ubuntu\.tail77e1e8\.ts\.net/g, "wsl-ubuntu.<YOUR_TAILNET>.ts.net");
  res = res.replace(/tail77e1e8\.ts\.net/g, "<YOUR_TAILNET>.ts.net");

  // 2. Tailscale Static IP (100.109.220.38)
  res = res.replace(/100\.109\.220\.38/g, "100.x.y.z");

  // 3. Physical LAN IP (192.168.1.8)
  res = res.replace(/192\.168\.1\.8:7890/g, "192.168.1.x:7890");
  res = res.replace(/192\.168\.1\.8:8000/g, "192.168.1.x:8000");
  res = res.replace(/192\.168\.1\.8/g, "192.168.1.x");

  // 4. Device Hostnames
  res = res.replace(/desktop-ht839ue/g, "<DESKTOP_HOST>");
  res = res.replace(/laptop-daq2t9ho/g, "<LAPTOP_HOST>");

  // 5. Windows Username & Absolute Paths
  res = res.replace(/C:\\Users\\Fortress/gi, "C:\\Users\\<username>");

  // 6. Linux Username & Absolute Paths
  res = res.replace(/\/home\/fortress/gi, "/home/<username>");

  return res;
}

// Process Desktop folder
if (fs.existsSync(desktopFolder)) {
  const files = fs.readdirSync(desktopFolder).filter(f => f.endsWith(".md") && !f.startsWith("."));
  for (const f of files) {
    const p = path.join(desktopFolder, f);
    const raw = fs.readFileSync(p, "utf8");
    const sanitized = sanitizeContent(raw);
    if (raw !== sanitized) {
      fs.writeFileSync(p, sanitized, "utf8");
      console.log(`[Sanitized Desktop] ${f}`);
    } else {
      console.log(`[Already Clean Desktop] ${f}`);
    }
  }
}

// Process Repo folder
if (fs.existsSync(repoFolder)) {
  const files = fs.readdirSync(repoFolder).filter(f => f.endsWith(".md") || f.endsWith(".mdx"));
  for (const f of files) {
    const p = path.join(repoFolder, f);
    const raw = fs.readFileSync(p, "utf8");
    const sanitized = sanitizeContent(raw);
    if (raw !== sanitized) {
      fs.writeFileSync(p, sanitized, "utf8");
      console.log(`[Sanitized Repo] ${f}`);
    } else {
      console.log(`[Already Clean Repo] ${f}`);
    }
  }
}
