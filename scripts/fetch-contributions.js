const fs = require("fs");
const https = require("https");
const USERNAME = process.env.CONTRIBUTOR_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || "";
const TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_OWNER = "OWASP";
const REPO_NAME = "cornucopia";

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      headers: {
        "User-Agent": "cornucopia-dashboard",
        "Authorization": "Bearer " + TOKEN,
        "Accept": "application/vnd.github.v3+json",
      },
    };
    https.get(options, res => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching for @" + USERNAME);
  const prs = await request("/repos/OWASP/cornucopia/pulls?state=all&per_page=100");
  const myPRs = Array.isArray(prs) ? prs.filter(pr => pr.user && pr.user.login === USERNAME) : [];
  const issues = await request("/repos/OWASP/cornucopia/issues?state=all&creator=" + USERNAME + "&per_page=100");
  const myIssues = Array.isArray(issues) ? issues.filter(i => !i.pull_request) : [];
  const commits = await request("/repos/OWASP/cornucopia/commits?author=" + USERNAME + "&per_page=100");
  const myCommits = Array.isArray(commits) ? commits : [];
  const activity = [];
  myPRs.slice(0,8).forEach(pr => activity.push({ type: "pull_request", title: pr.title, url: pr.html_url, date: pr.created_at, state: pr.merged_at ? "merged" : pr.state, ref: "#" + pr.number }));
  myIssues.slice(0,5).forEach(i => activity.push({ type: "issue", title: i.title, url: i.html_url, date: i.created_at, state: i.state, ref: "#" + i.number }));
  myCommits.slice(0,5).forEach(c => activity.push({ type: "commit", title: c.commit.message.split("
")[0], url: c.html_url, date: c.commit.author.date, ref: "#" + c.sha.slice(0,7) }));
  activity.sort((a,b) => new Date(b.date) - new Date(a.date));
  const out = { lastUpdated: new Date().toISOString(), username: USERNAME, totalCommits: myCommits.length, totalPRs: myPRs.length, mergedPRs: myPRs.filter(pr => pr.merged_at).length, openPRs: myPRs.filter(pr => pr.state === "open").length, totalIssues: myIssues.length, recentActivity: activity.slice(0,15) };
  fs.writeFileSync("data/github-contributions.json", JSON.stringify(out, null, 2));
  console.log("Done! commits=" + out.totalCommits + " PRs=" + out.totalPRs + " issues=" + out.totalIssues);
}
main().catch(e => { console.error(e); process.exit(1); });
