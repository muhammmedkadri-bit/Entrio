import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let fixedCount = 0;

walkDir('src/pages', (filePath) => {
  if (!filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const regex1 = /\{(\s*[a-zA-Z0-9_]+\s*)\?\s*\(\s*\)\s*:/g;
  if (regex1.test(content)) {
    content = content.replace(regex1, '{$1 ? ( <div className="p-8 text-center text-slate-400 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#7ed957] border-t-transparent rounded-full animate-spin"></div></div> ) :');
    changed = true;
  }
  
  const regex2 = /\{(\s*true\s*)\?\s*\(\s*\)\s*:/g;
  if (regex2.test(content)) {
     content = content.replace(regex2, '{true ? ( <div className="p-8 text-center text-slate-400 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#7ed957] border-t-transparent rounded-full animate-spin"></div></div> ) :');
     changed = true;
  }

  // Also standalone {loading && (\s*)} or {loading ? (\s*) : null} where the `(\s*)` is totally empty
  // Actually, I can just replace all `(\s*)` that are literally just whitespace inside a JSX expression, but that's risky.
  // Wait, let's also check for `{loading && (\s*)}`
  const regex3 = /\{(\s*[a-zA-Z0-9_]+\s*)&&\s*\(\s*\)\s*\}/g;
  if (regex3.test(content)) {
     content = content.replace(regex3, ''); // just remove it if it evaluates to empty
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
    fixedCount++;
  }
});

console.log(`Fixed ${fixedCount} files`);
