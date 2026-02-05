import axios from "axios";
import GithubAnalytics from "../../models/GithubAnalytics.js";

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
    {
      query,
      variables: { username },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  return res.data.data.user.contributionsCollection.contributionCalendar;
};

/* =========================
   Calendar → Streak Logic
========================= */
const calculateStreaks = (weeks) => {
  const days = weeks
    .flatMap(w => w.contributionDays)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const activeWeeksSet = new Set();

  const today = new Date().toISOString().slice(0, 10);

  // Helper: get ISO week key
  const getWeekKey = (dateStr) => {
    const d = new Date(dateStr);
    const year = d.getUTCFullYear();
    const week = Math.ceil(
      ((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7
    );
    return `${year}-W${week}`;
  };

  for (const day of days) {
    if (day.contributionCount > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      activeWeeksSet.add(getWeekKey(day.date));
    } else {
      tempStreak = 0;
    }
  }

let startIndex = days.length - 1;

while (startIndex >= 0 && days[startIndex].date > today) {
  startIndex--;
}

if (
  startIndex >= 0 &&
  days[startIndex].date === today &&
  days[startIndex].contributionCount === 0
) {
  startIndex--;
}

// 3️⃣ last active day থেকে streak count
for (let i = startIndex; i >= 0; i--) {
  if (days[i].contributionCount > 0) {
    currentStreak++;
  } else {
    break;
  }
}


  return {
    currentStreak,
    longestStreak,
    activeWeeks: activeWeeksSet.size,
  };
};


/* =========================
   MAIN ANALYTICS FUNCTION
========================= */
export const fetchAndSaveGithubData = async (username) => {
  // Fetch repos (public + private + forked)
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
  let totalCommitActivity = 0;

  // Repo + commit activity
  for (const repo of repoRes.data) {
    totalStars += repo.stargazers_count;
    totalForks += repo.forks_count;

    if (repo.private) privateRepos++;
    if (repo.fork) forkedRepos++;

    try {
      const commitRes = await axios.get(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits`,
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          },
          params: {
            author: repo.owner.login,
            per_page: 100,
          },
        }
      );
      totalCommitActivity += commitRes.data.length;
    } catch {}
  }

  // REST: PRs / Issues / Reviews
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

  // GraphQL: contribution calendar
  const calendar = await fetchContributionCalendar(username);
  const { currentStreak, longestStreak, activeWeeks } =
    calculateStreaks(calendar.weeks);

  const totalContributions = calendar.totalContributions;

  // Save to DB (remove old field if exists)
  const analytics = await GithubAnalytics.findOneAndUpdate(
    { username },
    {
      $set: {
        totalRepos,
        privateRepos,
        forkedRepos,
        totalStars,
        totalForks,
        totalCommitActivity,
        totalPRs,
        totalIssues,
        totalReviews,
        totalContributions,
        currentStreak,
        longestStreak,
        activeWeeks,
        lastUpdated: new Date(),
      },
      $unset: {
        totalCommits: "",
      },
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
