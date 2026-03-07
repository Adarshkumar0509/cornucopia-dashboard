const fs = require('fs');
const https = require('https');

const USERNAME = process.env.CONTRIBUTOR_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || '';
const TOKEN = process.env.GITHUB_TOKEN || '';

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'cornucopia-dashboard',
        'Authorization': 'Bearer ' + TOKEN,
        'Accept': 'application/vnd.github.v3.json',
      },
    };
    https.get(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching for @' + USERNAME);

  const prRes = await request('/repos/OWASP/cornucopia/pulls?state=all&per_page=100');
  const myPRS = Array.isArray(prRes) ? prRes.filter(pr => pr.user && pr.user.login === USERNAME) : [];

  const issRes = await request('/repos/OWASP/cornucopia/issues?state=all&creator=' + USERNAME + '&per_page=100');
  const myIssues = Array.isArray(issRes) ? issRes.filter(i => !i.pull_request) : [];

  const comRes = await request('/repos/OWASP/cornucopia/commits?author=' + USERNAME + '&per_page=100');
  const myCommits = Array.isArray(comRes) ? comRes : [];

  const activity = [];
  myPRS.slice(0, 8).forEach(pr => activity.push({ type: 'pull_request', title: pr.title, url: pr.html_url, date: pr.created_at, state: pr.merged_at ? 'merged' : pr.state, ref: '#' + pr.number }));
  myIssues.slice(0, 5).forEach(i => activity.push({ type: 'issue', title: i.title, url: i.html_url, date: i.created_at, state: i.state, ref: '#' + i.number }));
  myCommits.slice(0, 5).forEach(ch => activity.push({ type: 'commit', title: ch.commit.message.split('\n')[0], url: ch.html_url, date: ch.commit.author.date, ref: '#' + ch.sha.slice(0, 7) }));
  activity.sort((a, b) => new Date(b.date) - new Date(a.date));

  const out = {
    lastUpdated: new Date().toISOString(),
    username: USERNAME,
    totalCommits: myCommits.length,
    totalPRs: myPRS.length,
    mergedPRs: myPRS.filter(pr => pr.merged_at).length,
    openPRs: myPRS.filter(pr => pr.state === 'open').length,
    totalIssues: myIssues.length,
    recentActivity: activity.slice(0, 15)
  };

  fs.writeFileSync('data/github-contributions.json', JSON.stringify(out, null, 2));
  console.log('Done! commits=' + out.totalCommits + ' PRs=' + out.totalPRs + ' issues=' + out.totalIssues);
}

main().catch(e => { console.error(e); process.exit(1); });
