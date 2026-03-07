const fs = require('fs');
const https = require('https');

const USERNAME = process.env.CONTRIBUTOR_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || '';
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

  // Use search API - fetches PRs from forks too
  const mergedPRs = await request('/search/issues?q=repo:OWASP/cornucopia+type:pr+author:' + USERNAME + '+is:merged&per_page=100');
  const openPRs = await request('/search/issues?q=repo:OWASP/cornucopia+type:pr+author:' + USERNAME + '+is:open&per_page=100');
  const issues = await request('/search/issues?q=repo:OWASP/cornucopia+type:issue+author:' + USERNAME + '&per_page=100');
  const commits = await request('/repos/OWASP/cornucopia/commits?author=' + USERNAME + '&per_page=100');

  const myMergedPRs = mergedPRs.items || [];
  const myOpenPRs = openPRs.items || [];
  const myIssues = issues.items || [];
  const myCommits = Array.isArray(commits) ? commits : [];
  const allPRs = [...myMergedPRs, ...myOpenPRs];

  const activity = [];

  myMergedPRs.slice(0, 8).forEach(pr => activity.push({
    type: 'pull_request',
    title: pr.title,
    url: pr.html_url,
    date: pr.updated_at,
    state: 'merged',
    ref: '#' + pr.number
  }));

  myOpenPRs.slice(0, 4).forEach(pr => activity.push({
    type: 'pull_request',
    title: pr.title,
    url: pr.html_url,
    date: pr.updated_at,
    state: 'open',
    ref: '#' + pr.number
  }));

  myIssues.slice(0, 5).forEach(i => activity.push({
    type: 'issue',
    title: i.title,
    url: i.html_url,
    date: i.updated_at,
    state: i.state,
    ref: '#' + i.number
  }));

  myCommits.slice(0, 5).forEach(c => activity.push({
    type: 'commit',
    title: c.commit.message.split('\n')[0],
    url: c.html_url,
    date: c.commit.author.date,
    ref: '#' + c.sha.slice(0, 7)
  }));

  activity.sort((a, b) => new Date(b.date) - new Date(a.date));

  const out = {
    lastUpdated: new Date().toISOString(),
    username: USERNAME,
    totalCommits: myCommits.length,
    totalPRs: allPRs.length,
    mergedPRs: myMergedPRs.length,
    openPRs: myOpenPRs.length,
    totalIssues: myIssues.length,
    recentActivity: activity.slice(0, 15)
  };

  fs.writeFileSync('data/github-contributions.json', JSON.stringify(out, null, 2));
  console.log('Done! commits=' + out.totalCommits + ' PRs=' + out.totalPRs + ' merged=' + out.mergedPRs + ' issues=' + out.totalIssues);
}

main().catch(e => { console.error(e); process.exit(1); });
