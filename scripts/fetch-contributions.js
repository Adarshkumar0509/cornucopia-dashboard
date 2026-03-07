/**
 * fetch-contributions.js
 * Fetches your PRs, commits, and issues on OWASP/cornucopia
 * and writes them to data/github-contributions.json
 * 
 * Reads CONTRIBUTOR_GITHUB_USERNAME from repo variables or falls
 * back to the repo owner (you) when run via GitHub Actions.
 */

const fs   = require('fs');
const https = require('https');

// ── config ────────────────────────────────────────────────────────────────────
const REPO_OWNER = 'OWASP';
const REPO_NAME  = 'cornucopia';
const USERNAME   = process.env.CONTRIBUTOR_USERNAME   // set as repo variable
                || process.env.GITHUB_REPOSITORY_OWNER // fallback to repo owner
                || '';
const TOKEN      = process.env.GITHUB_TOKEN || '';
// ─────────────────────────────────────────────────────────────────────────────

if (!USERNAME) {
  console.error('❌  No GitHub username found. Set CONTRIBUTOR_USERNAME as a repository variable.');
  process.exit(1);
}

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent':    'cornucopia-dashboard-bot',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept':        'application/vnd.github.v3+json',
      },
    };
    https.get(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`📡  Fetching contributions for @${USERNAME} on ${REPO_OWNER}/${REPO_NAME}…`);

  // Pull Requests
  const prRes = await request(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all&per_page=100`
  );
  const allPRs = Array.isArray(prRes.data) ? prRes.data : [];
  const myPRs  = allPRs.filter(pr => pr.user?.login === USERNAME);

  // Issues
  const issRes = await request(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&creator=${USERNAME}&per_page=100`
  );
  const myIssues = Array.isArray(issRes.data)
    ? issRes.data.filter(i => !i.pull_request)
    : [];

  // Commits
  const comRes = await request(
    `/repos/${REPO_OWNER}/${REPO_NAME}/commits?author=${USERNAME}&per_page=100`
  );
  const myCommits = Array.isArray(comRes.data) ? comRes.data : [];

  // Recent activity feed (newest first)
  const activity = [];

  myPRs.slice(0, 8).forEach(pr => activity.push({
    type:  'pull_request',
    title: pr.title,
    url:   pr.html_url,
    date:  pr.created_at,
    state: pr.merged_at ? 'merged' : pr.state,
    ref:   `#${pr.number}`,
  }));

  myIssues.slice(0, 5).forEach(issue => activity.push({
    type:  'issue',
    title: issue.title,
    url:   issue.html_url,
    date:  issue.created_at,
    state: issue.state,
    ref:   `#${issue.number}`,
  }));

  myCommits.slice(0, 5).forEach(commit => activity.push({
    type:  'commit',
    title: commit.commit.message.split('\n')[0],
    url:   commit.html_url,
    date:  commit.commit.author.date,
    ref:   `#${commit.sha.slice(0, 7)}`,
  }));

  activity.sort((a, b) => new Date(b.date) - new Date(a.date));

  const output = {
    lastUpdated:  new Date().toISOString(),
    username:     USERNAME,
    totalCommits: myCommits.length,
    totalPRs:     myPRs.length,
    mergedPRs:    myPRs.filter(pr => pr.merged_at).length,
    openPRs:      myPRs.filter(pr => pr.state === 'open').length,
    totalIssues:  myIssues.length,
    recentActivity: activity.slice(0, 15),
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/github-contributions.json', JSON.stringify(output, null, 2));

  console.log('✅  Saved data/github-contributions.json');
  console.log(`   commits=${output.totalCommits}  PRs=${output.totalPRs}  merged=${output.mergedPRs}  issues=${output.totalIssues}`);
}

main().catch(err => { console.error(err); process.exit(1); });
