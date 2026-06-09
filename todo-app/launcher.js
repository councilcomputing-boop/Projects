const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const appDir = path.join(process.env.APPDATA || os.homedir(), 'TodoApp');
fs.mkdirSync(appDir, { recursive: true });

const htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');

const html = htmlTemplate
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="renderer.js"></script>', `<script>\n${js}\n</script>`);

const htmlPath = path.join(appDir, 'todo.html');
fs.writeFileSync(htmlPath, html);

exec(`start "" "${htmlPath}"`);
