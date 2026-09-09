const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, 'frontend/dashboard/src/app');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

let updatedCount = 0;

walkDir(targetDir, (filePath) => {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('http://localhost:8000') || content.includes('http://127.0.0.1:8000')) {


        let newContent = content;

        // Ensure getApiBaseUrl import is present
        if (!newContent.includes('getApiBaseUrl')) {
            // Find insertion index after last import or at top
            let importLines = newContent.match(/^import .*$/gm);
            if (importLines && importLines.length > 0) {
                let lastImport = importLines[importLines.length - 1];
                newContent = newContent.replace(lastImport, `${lastImport}\nimport { getApiBaseUrl } from "@/lib/api";`);
            } else {
                newContent = `import { getApiBaseUrl } from "@/lib/api";\n` + newContent;
            }
        }

        newContent = newContent.replace(/"http:\/\/(localhost|127\.0\.0\.1):8000([^"]*)"/g, '`${getApiBaseUrl()}$2`');
        newContent = newContent.replace(/'http:\/\/(localhost|127\.0\.0\.1):8000([^']*)'/g, '`${getApiBaseUrl()}$2`');

        newContent = newContent.replace(/`http:\/\/(localhost|127\.0\.0\.1):8000/g, '`${getApiBaseUrl()}');

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Updated: ${path.relative(__dirname, filePath)}`);
            updatedCount++;
        }
    }
});

console.log(`\nFinished! Successfully updated ${updatedCount} files.`);
