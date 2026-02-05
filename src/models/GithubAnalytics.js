import mongoose from "mongoose";

const GithubAnalyticsSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },

  // Repo stats
  totalRepos: Number,
  privateRepos: Number,
  forkedRepos: Number,

  // Popularity
  totalStars: Number,
  totalForks: Number,

  // Activity (REST)
  totalCommitActivity: Number,
  totalPRs: Number,
  totalIssues: Number,
  totalReviews: Number,

  // Contribution calendar (GraphQL)
  totalContributions: Number,
  currentStreak: Number,
  longestStreak: Number,
  activeWeeks: Number,

  lastUpdated: Date,
});

export default mongoose.model(
  "GithubAnalytics",
  GithubAnalyticsSchema
);
