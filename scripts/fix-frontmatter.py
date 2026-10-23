import os
import re
import yaml

folder = r"C:\Users\Fortress\.gemini\antigravity\scratch\Explorer\src\content\posts\2026"
files = [f for f in sorted(os.listdir(folder)) if f.endswith(".md") or f.endswith(".mdx")]

for fname in files:
    fpath = os.path.join(folder, fname)
    with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
        raw = fp.read()
    
    # Match frontmatter
    # Look for opening --- and find where YAML actually ends
    # The YAML fields are: author, pubDatetime, modDatetime, title, featured, draft, tags, description, ogImage, canonicalURL, slug
    
    # First, let's see if there is standard --- ... ---
    parts = raw.split("---")
    if len(parts) >= 3:
        # parts[0] is usually empty
        # parts[1] is frontmatter
        # parts[2:] is body
        fm_text = parts[1].strip()
        body = "---".join(parts[2:]).strip()
        
        # Check if description has leaked body text
        # If fm_text has lines not belonging to YAML, split them
        # Let's parse fm_text line by line
        fm_lines = fm_text.splitlines()
        clean_fm = []
        overflow_body = []
        
        in_description = False
        in_tags = False
        
        for line in fm_lines:
            sline = line.strip()
            if any(sline.startswith(k + ":") for k in ["author", "pubDatetime", "modDatetime", "title", "featured", "draft", "description", "ogImage", "canonicalURL", "slug"]):
                clean_fm.append(line)
                in_tags = False
                in_description = sline.startswith("description:")
            elif sline.startswith("tags:"):
                clean_fm.append(line)
                in_tags = True
                in_description = False
            elif in_tags and (sline.startswith("-") or sline.startswith("  -")):
                clean_fm.append(line)
            elif in_description and (line.startswith("  ") or line.startswith("\t")):
                clean_fm.append(line)
            else:
                # This line doesn't belong in YAML frontmatter!
                overflow_body.append(line)
        
        reconstructed_body = ""
        if overflow_body:
            reconstructed_body = "\n".join(overflow_body).strip() + "\n\n"
        reconstructed_body += body
        
        # Remove any leading # Title from body to avoid duplicate H1
        reconstructed_body = re.sub(r"^# [^\r\n]+\r?\n+", "", reconstructed_body)
        
        new_content = "---\n" + "\n".join(clean_fm).strip() + "\n---\n\n" + reconstructed_body.strip() + "\n"
        
        # Validate with pyyaml
        try:
            yaml.safe_load("\n".join(clean_fm))
            with open(fpath, "w", encoding="utf-8") as out:
                out.write(new_content)
            print(f"Validated & Cleaned FM for: {fname}")
        except Exception as e:
            print(f"ERROR in {fname}: {e}")
    else:
        print(f"NO standard --- in {fname}!")
