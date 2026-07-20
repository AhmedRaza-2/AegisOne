import os
import shutil
import re

source_dir = r"C:\Users\k.shahzad\Documents\landing\src"
target_dir = r"D:\Coding Projects\AegisOne\frontend\landing\src"

print("Copying UI files...")

# 1. Copy index.css
shutil.copy2(os.path.join(source_dir, "index.css"), os.path.join(target_dir, "index.css"))
print("Copied index.css")

# 2. Copy components
source_components = os.path.join(source_dir, "components")
target_components = os.path.join(target_dir, "components")
os.makedirs(target_components, exist_ok=True)
for file in os.listdir(source_components):
    if file.endswith(".jsx"):
        dest_path = os.path.join(target_components, file)
        shutil.copy2(os.path.join(source_components, file), dest_path)
        
        # If it's HeroSection, fix the links
        if file == "HeroSection.jsx":
            with open(dest_path, "r", encoding="utf-8") as hf:
                content = hf.read()
            content = content.replace('href="http://localhost:3001/"', 'href="http://localhost:3000/register"')
            content = content.replace('href="http://localhost:3002/login"', 'href="http://localhost:8000/docs"')
            with open(dest_path, "w", encoding="utf-8") as hf:
                hf.write(content)
        
        print(f"Copied {file}")

# 3. Copy ui-elements
source_ui = os.path.join(source_dir, "ui-elements")
target_ui = os.path.join(target_dir, "ui-elements")
if os.path.exists(source_ui):
    os.makedirs(target_ui, exist_ok=True)
    for file in os.listdir(source_ui):
        if file.endswith(".jsx"):
            shutil.copy2(os.path.join(source_ui, file), os.path.join(target_ui, file))
            print(f"Copied {file}")

# 4. Modify App.tsx to use the new UI but keep modals and existing logic
app_tsx_path = os.path.join(target_dir, "App.tsx")
with open(app_tsx_path, "r", encoding="utf-8") as f:
    app_content = f.read()

# Add imports for new components
new_imports = """import SiteHeader from './components/SiteHeader';
import HeroSection from './components/HeroSection';
import SectionServices from './components/SectionServices';
import SectionProcess from './components/SectionProcess';
import SectionTechStack from './components/SectionTechStack';
import SectionAbout from './components/SectionAbout';
import SectionReviews from './components/SectionReviews';
import SectionContact from './components/SectionContact';
import SiteFooter from './components/SiteFooter';
"""

# Replace old imports with new ones (we'll just prepend them after the first import)
app_content = re.sub(r"(import React.*?;\n)", r"\1" + new_imports, app_content, count=1)

# Now replace the rendering part.
# We want to replace the old <Header />, <main>...</main>, and <Footer /> with the new ones.
# We'll use regex to replace everything from {/* Navigation Header */} down to just before {/* 2. STATEFUL LIVE DEMO SCHEDULER MODAL */}

new_render = """      {/* Navigation Header */}
      <SiteHeader />

      {/* Main Container */}
      <main className="flex-1" id="main-content">
        <div className="animate-fadeIn">
          <HeroSection />
          <SectionServices />
          <SectionProcess />
          <SectionTechStack />
          <SectionAbout />
          <SectionReviews />
          <SectionContact />
        </div>
      </main>

      {/* Footer Brand bar */}
      <SiteFooter />
"""

app_content = re.sub(
    r"\{\/\* Navigation Header \*\/\}.*?\{\/\* 2\. STATEFUL LIVE DEMO SCHEDULER MODAL \*\/\}",
    new_render + "\n      {/* 2. STATEFUL LIVE DEMO SCHEDULER MODAL */}",
    app_content,
    flags=re.DOTALL
)

with open(app_tsx_path, "w", encoding="utf-8") as f:
    f.write(app_content)

print("Updated App.tsx to use new UI while preserving login, signup, and modals!")
print("Done. Please run 'npm run dev' to see the changes.")
