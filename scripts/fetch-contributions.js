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

  // Use search API to find PRs from forks too
  const prSearch = await request(
    '/search/issues?q=repo:OWASP/cornucopia+type:pr+author:' + USERNAME + '&per_page=100'
  );
  const myPRs = (prSearch.items || []);

  // Fetch issues
  const issSearch = await request(
    '/search/issues?q=repo:OWASP/cornucopia+type:issue+author:' + USERNAME + '&per_page=100'
  );
  const myIssues = (issSearch.items || []);

  // Fetch commits
  const comRes = await request(
    '/repos/OWASP/cornucopia/commits?author=' + USERNAME + '&per_page=100'
  );
  const myCommits = Array.isArray(comRes) ? comRes : [];

  const activity = [];

  myPRs.slice(0, 8).forEach(pr => activity.push({
    type: 'pull_request',
    title: pr.title,
    url: pr.html_url,
    date: pr.created_at,
    state: pr.pull_request && pr.pull_request.merged_at ? 'merged' : pr.state,
    ref: '#' + pr.number
  }));

  myIssues.slice(0, 5).forEach(i => activity.push({
    type: 'issue',
    title: i.title,
    url: i.html_url,
    date: i.created_at,
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
    totalPRs: myPRs.length,
    mergedPRs: myPRs.filter(pr => pr.pull_request && pr.pull_request.merged_at).length,
    openPRs: myPRs.filter(pr => pr.state === 'open').length,
    totalIssues: myIssues.length,
    recentActivity: activity.slice(0, 15)
  };

  fs.writeFileSync('data/github-contributions.json', JSON.stringify(out, null, 2));
  console.log('Done! commits=' + out.totalCommits + ' PRs=' + out.totalPRs + ' merged=' + out.mergedPRs + ' issues=' + out.totalIssues);
}

main().catch(e => { console.error(e); process.exit(1); });
