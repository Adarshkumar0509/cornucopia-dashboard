/**
 * inject-stats.js
 * Reads data/github-contributions.json and patches the
 * stats + activity inside the CONFIG block of index.html
 * so the page works even without a local server.
 */

const fs = require('fs');

const dataPath  = 'data/github-contributions.json';
const htmlPath  = 'index.html';

if (!fs.existsSync(dataPath)) {
  console.log('⚠️   No contributions data found, skipping injection.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
let   html = fs.readFileSync(htmlPath, 'utf8');

// ── Patch stats block ─────────────────────────────────────────────────────────
const statsBlock = `  stats: {
    commits: ${data.totalCommits},
    pullRequests: ${data.totalPRs},
    mergedPRs: ${data.mergedPRs},
    issues: ${data.totalIssues},
  },`;

html = html.replace(
  /\/\* ---- GitHub Contribution Stats[\s\S]*?},\n\n/,
  statsBlock + '\n\n'
);

// ── Patch activity array ──────────────────────────────────────────────────────
const activityItems = (data.recentActivity || []).map(item => {
  return `    {
      type:  "${item.type}",
      title: ${JSON.stringify(item.title)},
      url:   "${item.url}",
      date:  "${item.date.slice(0, 10)}",
      state: "${item.state || ''}",
      ref:   "${item.ref || ''}",
    }`;
}).join(',\n');

const activityBlock = `  activity: [\n${activityItems}\n  ],`;

html = html.replace(
  /\/\* ---- Recent Activity[\s\S]*?],\n\n/,
  activityBlock + '\n\n'
);

fs.writeFileSync(htmlPath, html);
console.log('✅  Injected stats + activity into index.html');
console.log(`   last updated: ${data.lastUpdated}`);
