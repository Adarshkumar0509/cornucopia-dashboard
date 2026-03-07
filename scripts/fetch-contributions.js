const fs = require('fs');
const https = require('https');

const USERNAME = process.env.CONTRIBUTOR_USERNAME || '';
const TOKEN = process.env.GITHUB_TOKEN || '';

function request(path) {
  return new Promise((resolve, reject) => {
    const opt = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'cornucopia-dashboard',
        'Authorization': 'Bearer ' + TOKEN,
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    https.get(opt, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching for @' + USERNAME);

  const mergedPRs = await request('/search/issues?q=repo:OWASP/cornucopia+type:pr+author:' + USERNAME + '+is:merged&per_page=100&sort=updated');
  const openPRs = await request('/search/issues?q=repo:OWASP/cornucopia+type:pr+author:' + USERNAME + '+is:open&per_page=100');
  const issues = await request('/search/issues?q=repo:OWASP/cornucopia+type:issue+author:' + USERNAME + '&per_page=100');
  const commits = await request('/repos/OWASP/cornucopia/commits?author=' + USERNAME + '&per_page=100');

  const myMergedPRs = mergedPRs.items || [];
  const myOpenPRs = openPRs.items || [];
  const myIssues = issues.items || [];
  const myCommits = Array.isArray(commits) ? commits : [];
  const allPRs = [...myMergedPRs, ...myOpenPRs];

  // Load existing data to preserve manual entries
  let existing = { recentActivity: [] };
  try { existing = JSON.parse(fs.readFileSync('data/github-contributions.json', 'utf8')); } catch(e) {}

  const activity = [];
  const seenRefs = new Set();

  // Add fresh fetched data
  myMergedPRs.forEach(pr => {
    const ref = '#' + pr.number;
    seenRefs.add(ref);
    activity.push({ type: 'pull_request', title: pr.title, url: pr.html_url, date: pr.updated_at, state: 'merged', ref: ref });
  });

  myOpenPRs.forEach(pr => {
    const ref = '#' + pr.number;
    seenRefs.add(ref);
    activity.push({ type: 'pull_request', title: pr.title, url: pr.html_url, date: pr.updated_at, state: 'open', ref: ref });
  });

  myIssues.forEach(i => {
    const ref = '#' + i.number;
    seenRefs.add(ref);
    activity.push({ type: 'issue', title: i.title, url: i.html_url, date: i.updated_at, state: i.state, ref: ref });
  });

  myCommits.forEach(c => {
    const ref = '#' + c.sha.slice(0, 7);
    seenRefs.add(ref);
    activity.push({ type: 'commit', title: c.commit.message.split('\n')[0], url: c.html_url, date: c.commit.author.date, ref: ref });
  });

  // Preserve manual entries not returned by API
  for (const entry of (existing.recentActivity || [])) {
    if (entry.ref && !seenRefs.has(entry.ref)) {
      activity.push(entry);
      console.log('Preserved manual entry:', entry.ref);
    }
  }

  activity.sort((a, b) => new Date(b.date) - new Date(a.date));

  const out = {
    lastUpdated: new Date().toISOString(),
    username: USERNAME,
    totalCommits: myCommits.length,
    totalPRs: allPRs.length,
    mergedPRs: myMergedPRs.length + (activity.filter(e => e.state === 'merged' && !myMergedPRs.find(p => '#'+p.number === e.ref)).length),
    openPRs: myOpenPRs.length,
    totalIssues: myIssues.length,
    recentActivity: activity.slice(0, 20)
  };

  fs.writeFileSync('data/github-contributions.json', JSON.stringify(out, null, 2));
  console.log('Done! commits=' + out.totalCommits + ' PRs=' + out.totalPRs + ' merged=' + out.mergedPRs + ' issues=' + out.totalIssues);
}

main().catch(e => { console.error(e); process.exit(1); });
