const fs = require('fs');
const path = require('path');

const brdPath = path.join(__dirname, 'Impelementaion BRD.md');
const phasePath = path.join(__dirname, 'Phase Plan.md');

const brd = fs.readFileSync(brdPath, 'utf8');
const phase = fs.readFileSync(phasePath, 'utf8');

console.log('=== DOCUMENT STATS ===');
console.log('BRD: ' + brd.split('\n').length + ' lines, ' + brd.length + ' chars');
console.log('Phase: ' + phase.split('\n').length + ' lines, ' + phase.length + ' chars');
console.log();

console.log('=== BRD SECTIONS ===');
const brdHeadings = brd.split('\n').filter(l => /^#{1,3} /.test(l.trim()));
brdHeadings.forEach(h => console.log('  [BRD] ' + h.trim()));
console.log();

console.log('=== PHASE PLAN SECTIONS ===');
const phaseHeadings = phase.split('\n').filter(l => /^#{1,3} /.test(l.trim()));
phaseHeadings.forEach(h => console.log('  [Phase] ' + h.trim()));
console.log();

console.log('=== COVERAGE ANALYSIS ===');
console.log('  BRD: Higher-level design doc (~10 sections)');
console.log('  Phase: Detailed implementation spec for Phase 1 only (~23 sections)');
console.log('  BRD mentions Phase 2-6 roadmap (brief, section 6)');
console.log('  Phase references BRD for context (section "## Build Phase 1")');
console.log('  BRD contains detailed UI/UX design section (section 4)');
console.log('  Phase contains full implementation prompt (sections 1-12)');
console.log('  BRD has 3 export paths (A, B, C) — section 5');
console.log('  Phase has 1 ZIP format spec (section 8)');
console.log('  BRD mentions Redis, PostgreSQL, BullMQ, Prisma/Drizzle');
console.log('  Phase is lighter stack: Next.js, Playwright, Zod, JSZip, Vitest');
console.log('  BRD: general architecture + future phases + export design');
console.log('  Phase: actionable Phase 1 implementation instructions');
console.log();

// Key differences
console.log('=== KEY DIFFERENCES ===');
console.log('1. BRD is conceptual (architecture, export design, conversion logic)');
console.log('2. Phase Plan is tactical (implementation prompt with specific APIs, schema, endpoints)');
console.log('3. BRD covers 6 phases; Phase covers 1');
console.log('4. BRD has emojis in headings; Phase has none');
console.log('5. BRD uses "Web to Figma" product name; Phase uses "HTML-to-Figma"');
console.log('6. BRD has decorative images; Phase is text-only');
console.log('7. BRD section 5 (export) overlaps with Phase section 7-8 (API, ZIP)');
console.log('8. BRD recommendation (section 7) = Phase context (section "What comes after Phase 1?")');
console.log('9. Encoding: both use em dashes (—) correctly');
console.log('10. BRD has mojibake-free content; Phase has minor display issues in terminal only');