import axios from "axios";
import GithubAnalytics from "../models/GithubAnalytics.js";
import * as cheerio from "cheerio";

/* =========================
   GraphQL: Contribution Calendar
========================= */
const fetchContributionCalendar = async (username) => {
  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await axios.post(
    "https://api.github.com/graphql",
    { query, variables: { username } },
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  return res.data.data.user.contributionsCollection.contributionCalendar;
};

/* 
   SCRAPE (TRY) — fallback GraphQL if blocked
*/
const scrapeExactGitHubStats = async (username) => {
  try {
    const url = `https://github.com/users/${username}/contributions`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(data);

    const text = $("h2").first().text().trim();
    const match = text.match(/(\d+)/);
    const totalContributions = match ? parseInt(match[1]) : 0;

    const days = [];

    $("rect[data-date]").each((i, el) => {
      days.push({
        date: $(el).attr("data-date"),
        count: parseInt($(el).attr("data-count") || "0"),
      });
    });

    if (days.length === 0) throw new Error("Blocked");

    let longestStreak = 0;
    let temp = 0;

    for (const d of days) {
      if (d.count > 0) {
        temp++;
        longestStreak = Math.max(longestStreak, temp);
      } else temp = 0;
    }

    let currentStreak = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) currentStreak++;
      else if (days[i].date === today) continue;
      else break;
    }

    return { totalContributions, longestStreak, currentStreak };
  } catch {
    console.log("⚠️ Scrape blocked → using GraphQL fallback");
    return null;
  }
};

/* 
   GraphQL Streak Logic
 */
const calculateStreaks = (weeks) => {
  const days = weeks
    .flatMap((w) => w.contributionDays)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let longestStreak = 0;
  let currentStreak = 0;
  let temp = 0;

  const today = new Date().toISOString().slice(0, 10);

  for (const d of days) {
    if (d.contributionCount > 0) {
      temp++;
      longestStreak = Math.max(longestStreak, temp);
    } else temp = 0;
  }

  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) currentStreak++;
    else if (days[i].date === today) continue;
    else break;
  }

  const activeWeeks = new Set(
    days.filter((d) => d.contributionCount > 0).map((d) => d.date.slice(0, 7))
  ).size;

  return { longestStreak, currentStreak, activeWeeks };
};

/* 
   MAIN FUNCTION
*/
export const fetchAndSaveGithubData = async (username) => {
  const repoRes = await axios.get(
    "https://api.github.com/user/repos?per_page=100&type=all",
    {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  let totalRepos = repoRes.data.length;
  let privateRepos = 0;
  let forkedRepos = 0;
  let totalStars = 0;
  let totalForks = 0;

  repoRes.data.forEach((repo) => {
    totalStars += repo.stargazers_count;
    totalForks += repo.forks_count;
    if (repo.private) privateRepos++;
    if (repo.fork) forkedRepos++;
  });

  // PR / Issue / Review
  const since = new Date(
    new Date().setFullYear(new Date().getFullYear() - 1)
  )
    .toISOString()
    .split("T")[0];

  const search = async (q) =>
    (
      await axios.get("https://api.github.com/search/issues", {
        headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
        params: { q, per_page: 1 },
      })
    ).data.total_count;

  const totalPRs = await search(`author:${username} type:pr created:>=${since}`);
  const totalIssues = await search(
    `author:${username} type:issue created:>=${since}`
  );
  const totalReviews = await search(
    `reviewed-by:${username} created:>=${since}`
  );

  // GraphQL calendar
  const calendar = await fetchContributionCalendar(username);
  const gqlStats = calculateStreaks(calendar.weeks);

  // Try scrape
  const scraped = await scrapeExactGitHubStats(username);

  const totalContributions = scraped?.totalContributions ?? calendar.totalContributions;
  const longestStreak = scraped?.longestStreak ?? gqlStats.longestStreak;
  const currentStreak = scraped?.currentStreak ?? gqlStats.currentStreak;
  const activeWeeks = gqlStats.activeWeeks;

  const analytics = await GithubAnalytics.findOneAndUpdate(
    { username },
    {
      totalRepos,
      privateRepos,
      forkedRepos,
      totalStars,
      totalForks,
      totalPRs,
      totalIssues,
      totalReviews,
      totalContributions,
      currentStreak,
      longestStreak,
      activeWeeks,
      lastUpdated: new Date(),
    },
    { upsert: true, new: true }
  );

  return analytics;
};

export const getGithubAnalytics = async (req, res) => {
  const data = await GithubAnalytics.findOne({
    username: req.params.username,
  });

  if (!data) return res.status(404).json({ message: "No data found" });

  res.json(data);
};
