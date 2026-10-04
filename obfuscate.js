/**
 * obfuscate.js — Build script: genera dist/ con JS fuertemente ofuscado.
 * Uso: node obfuscate.js
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs   = require('fs');
const path = require('path');

// ─── Configuración ────────────────────────────────────────────────────────────

const SRC_ROOT  = path.join(__dirname);
const DIST_ROOT = path.join(__dirname, 'dist');

/** Archivos/carpetas del raíz que se copian al dist */
const ROOT_FILES = [
  'index.html',
  'manifest.json',
  'version.txt',
  'netlify.toml',
  'sw.js',
];

/** Carpetas de assets que se copian (js se ofusca, el resto se copia tal cual) */
const ASSETS_DIR  = path.join(SRC_ROOT, 'assets');
const DIST_ASSETS = path.join(DIST_ROOT, 'assets');

/** Opciones de ofuscación — nivel ALTO */
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.9,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,          // false para no romper APIs globales
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.8,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 3,
  stringArrayWrappersChunkLength: 3,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.85,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,   // evita archivos enormes
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Recorre recursivamente un directorio y llama cb(srcFile, destFile)
 * para cada archivo encontrado.
 */
function walkDir(srcDir, destDir, cb) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir)) {
    const srcEntry  = path.join(srcDir,  entry);
    const destEntry = path.join(destDir, entry);
    const stat = fs.statSync(srcEntry);
    if (stat.isDirectory()) {
      ensureDir(destEntry);
      walkDir(srcEntry, destEntry, cb);
    } else {
      cb(srcEntry, destEntry);
    }
  }
}

// ─── Proceso principal ────────────────────────────────────────────────────────

console.log('🔨  Iniciando build con ofuscación...\n');

// 1. Limpiar dist/
if (fs.existsSync(DIST_ROOT)) {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
  console.log('🗑️   dist/ limpiado');
}
ensureDir(DIST_ROOT);

// 2. Copiar archivos del raíz
for (const file of ROOT_FILES) {
  const src  = path.join(SRC_ROOT, file);
  const dest = path.join(DIST_ROOT, file);
  if (fs.existsSync(src)) {
    copyFile(src, dest);
    console.log(`📄  Copiado:    ${file}`);
  }
}

// 3. Copiar assets (css, icons) tal cual
const assetSubdirs = fs.readdirSync(ASSETS_DIR);
for (const sub of assetSubdirs) {
  if (sub === 'js') continue; // se procesa aparte
  const srcSub  = path.join(ASSETS_DIR,  sub);
  const destSub = path.join(DIST_ASSETS, sub);
  if (fs.statSync(srcSub).isDirectory()) {
    walkDir(srcSub, destSub, copyFile);
    console.log(`📁  Copiado:    assets/${sub}/`);
  }
}

// 4. Ofuscar archivos JS
const srcJs  = path.join(ASSETS_DIR,  'js');
const distJs = path.join(DIST_ASSETS, 'js');
let   jsCount = 0;
let   jsErrors = 0;

walkDir(srcJs, distJs, (srcFile, destFile) => {
  if (!srcFile.endsWith('.js')) {
    copyFile(srcFile, destFile);
    return;
  }

  try {
    const code = fs.readFileSync(srcFile, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
    ensureDir(path.dirname(destFile));
    fs.writeFileSync(destFile, result.getObfuscatedCode(), 'utf8');
    const rel = path.relative(SRC_ROOT, srcFile).replace(/\\/g, '/');
    console.log(`🔒  Ofuscado:   ${rel}`);
    jsCount++;
  } catch (err) {
    const rel = path.relative(SRC_ROOT, srcFile).replace(/\\/g, '/');
    console.error(`❌  Error en:   ${rel} — ${err.message}`);
    jsErrors++;
    // Copiar sin ofuscar como fallback
    copyFile(srcFile, destFile);
  }
});

// 5. sw.js raíz también se ofusca (ya fue copiado, ahora se reemplaza)
const swSrc  = path.join(SRC_ROOT,  'sw.js');
const swDest = path.join(DIST_ROOT, 'sw.js');
if (fs.existsSync(swSrc)) {
  try {
    const code   = fs.readFileSync(swSrc, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, {
      ...OBFUSCATOR_OPTIONS,
      selfDefending: false,    // service workers no soportan self-defending
      debugProtection: false,
    });
    fs.writeFileSync(swDest, result.getObfuscatedCode(), 'utf8');
    console.log('🔒  Ofuscado:   sw.js');
    jsCount++;
  } catch (err) {
    console.error(`❌  Error en sw.js — ${err.message}`);
  }
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n✅  Build completado.`);
console.log(`    JS ofuscados : ${jsCount}`);
if (jsErrors > 0) console.log(`    Errores      : ${jsErrors}`);
console.log(`    Salida       : ${DIST_ROOT}`);
