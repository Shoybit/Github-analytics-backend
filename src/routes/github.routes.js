import { connectDB } from "../config/db.js";
import express from "express";
import GithubAnalytics from "../models/GithubAnalytics.js";
import {
  fetchAndSaveGithubData,
  getGithubAnalytics,
} from "../controllers/github.controller.js";


const router = express.Router();

/* =========================
   SVG ROUTE (MUST BE FIRST)
========================= */
router.get("/stats.svg", async (req, res) => {
  try {
    await connectDB();

    const username = req.query.user;
    if (!username) {
      return res.status(400).type("text/plain").send("Username required");
    }

    const data = await GithubAnalytics.findOne({ username }).lean();

    if (!data) {
      return res.status(404).setHeader("Content-Type", "image/svg+xml").send(`
<svg width="720" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="200" fill="#0d1117"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="#f85149" font-size="18">
    No analytics data
  </text>
</svg>`);
    }

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");


    // Calculate values for visualizations
    const maxTotal = Math.max(data.totalContributions, 1000);
    const maxStreak = Math.max(data.currentStreak, data.longestStreak, 30, 1);
    
    const totalPercent = Math.min((data.totalContributions / maxTotal) * 100, 100);
    const currentPercent = Math.min((data.currentStreak / maxStreak) * 100, 100);
    const longestPercent = Math.min((data.longestStreak / maxStreak) * 100, 100);
    
    // Calculate actual widths for progress bars
    const totalWidth = (totalPercent * 1.6);
    const currentWidth = (currentPercent * 1.6);
    const longestWidth = (longestPercent * 1.6);
    
    // Format large numbers
    const formatNumber = (num) => {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      }
      return num.toString();
    };
    
    // Get streak emoji based on performance
    const getStreakEmoji = (streak) => {
      if (streak >= 30) return '🔥';
      if (streak >= 15) return '⚡';
      if (streak >= 7) return '🚀';
      if (streak >= 3) return '🌟';
      return '✨';
    };
    
    // Determine activity level
    const getActivityLevel = () => {
      const avgDaily = data.totalContributions / 365;
      if (avgDaily >= 10) return 'Extreme';
      if (avgDaily >= 5) return 'High';
      if (avgDaily >= 2) return 'Moderate';
      return 'Light';
    };
    
    const activityLevel = getActivityLevel();
    const lastUpdated = new Date(data.lastUpdated || Date.now()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Calculate daily average
    const dailyAvg = (data.totalContributions / 365).toFixed(1);
    
    // Get colors based on activity level
    const getActivityColor = () => {
      switch(activityLevel) {
        case 'Extreme': return '#ff6b6b';
        case 'High': return '#ffa726';
        case 'Moderate': return '#4ecdc4';
        default: return '#8b949e';
      }
    };

    const svg = `
<svg width="720" height="340" viewBox="0 0 720 340" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Gradients -->
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#238636"/>
      <stop offset="50%" stop-color="#1f6feb"/>
      <stop offset="100%" stop-color="#8957e5"/>
    </linearGradient>
    
    <linearGradient id="contributionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF416C"/>
      <stop offset="100%" stop-color="#FF4B2B"/>
    </linearGradient>
    
    <linearGradient id="streakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2193b0"/>
      <stop offset="100%" stop-color="#6dd5ed"/>
    </linearGradient>
    
    <linearGradient id="recordGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#11998e"/>
      <stop offset="100%" stop-color="#38ef7d"/>
    </linearGradient>
    
    <!-- Improved icons -->
    <symbol id="icon-contrib" viewBox="0 0 24 24">
      <path fill="url(#contributionGradient)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      <circle cx="12" cy="12" r="2.5" fill="#fff" opacity="0.8"/>
    </symbol>

    <symbol id="icon-fire" viewBox="0 0 24 24">
      <!-- Animated flame -->
      <path fill="#ff6b3d" d="M12 23c5.52 0 10-4.48 10-10 0-4.84-3.44-8.87-8-9.8v-.2C14 1 12 1 12 1s-2 0-2 2v.2c-4.56.93-8 4.96-8 9.8 0 5.52 4.48 10 10 10z">
        <animate attributeName="fill" values="#ff6b3d;#ff8c42;#ff6b3d" dur="2s" repeatCount="indefinite"/>
      </path>
      <path fill="#ffd166" d="M12 21c4.42 0 8-3.58 8-8 0-3.72-2.56-6.83-6-7.73v-.27C14 3 12 3 12 3s-2 0-2 2v.27c-3.44.9-6 4.01-6 7.73 0 4.42 3.58 8 8 8z">
        <animate attributeName="fill" values="#ffd166;#fff275;#ffd166" dur="2s" repeatCount="indefinite"/>
      </path>
    </symbol>

    <symbol id="icon-trophy" viewBox="0 0 24 24">
      <path fill="url(#recordGradient)" d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
      <circle cx="12" cy="9" r="1.5" fill="#fff" opacity="0.8"/>
    </symbol>

    <symbol id="icon-calendar" viewBox="0 0 24 24">
      <path fill="#8b949e" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
      <rect x="7" y="10" width="3" height="3" rx="1" fill="#2193b0"/>
      <rect x="12" y="10" width="3" height="3" rx="1" fill="#2193b0"/>
      <rect x="17" y="10" width="3" height="3" rx="1" fill="#2193b0"/>
    </symbol>

    <symbol id="icon-activity" viewBox="0 0 24 24">
      <path fill="${getActivityColor()}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </symbol>
    
    <!-- Simple animations -->
    <style type="text/css">
      <![CDATA[
        .progress-bar {
          animation: grow 1s ease-out;
        }
        @keyframes grow {
          from { width: 0; }
        }
        .fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .slide-up {
          animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      ]]>
    </style>
  </defs>
  
  <!-- Background with subtle pattern -->
  <rect width="720" height="340" rx="20" fill="#0d1117"/>
  
  <!-- Header with gradient -->
  <g class="fade-in">
    <rect width="720" height="80" rx="20 20 0 0" fill="url(#mainGradient)" opacity="0.9"/>
    <rect width="720" height="80" rx="20 20 0 0" fill="#161b22" opacity="0.8"/>
    
    <!-- GitHub logo -->
    <path d="M35 50c-3.3 0-6 2.7-6 6 0 2.65 1.72 4.9 4.1 5.7.3.06.4-.13.4-.29v-1.12c-1.67.36-2.02-.71-2.02-.71-.27-.69-.67-.88-.67-.88-.54-.37.04-.36.04-.36.6.04.92.62.92.62.53.92 1.4.65 1.75.5.05-.39.21-.65.38-.8-1.33-.15-2.73-.67-2.73-2.97 0-.66.23-1.19.62-1.61-.06-.15-.27-.76.06-1.59 0 0 .5-.16 1.65.62.48-.13 1-.2 1.52-.2s1.04.07 1.52.2c1.15-.78 1.65-.62 1.65-.62.33.83.12 1.44.06 1.59.39.42.62.95.62 1.61 0 2.3-1.4 2.82-2.74 2.96.21.19.41.55.41 1.11v1.65c0 .16.1.35.4.29 2.38-.8 4.1-3.05 4.1-5.7 0-3.3-2.7-6-6-6z" fill="#fff"/>
    
    <text x="75" y="58" fill="#f0f6fc" font-size="24" font-weight="bold" font-family="Arial, sans-serif">
      GitHub Analytics
    </text>
    <text x="690" y="58" text-anchor="end" fill="#f0f6fc" font-size="16" font-weight="600" font-family="Arial, sans-serif" class="pulse">
      @${username}
    </text>
  </g>
  
  <!-- Stats Cards with improved layout -->
  <g transform="translate(40, 110)">
    <!-- Total Contributions Card -->
    <g class="slide-up">
      <rect width="200" height="130" rx="15" fill="#161b22" stroke="#30363d" stroke-width="1.5"/>
      <rect width="200" height="5" rx="15 15 0 0" fill="url(#contributionGradient)"/>
      
      <use xlink:href="#icon-contrib" x="20" y="35" width="28" height="28"/>
      <text x="56" y="54" fill="#8b949e" font-size="13" font-weight="600" font-family="Arial, sans-serif">
        Total Contributions
      </text>
      <text x="100" y="95" text-anchor="middle" fill="#f0f6fc" font-size="34" font-weight="bold" font-family="Arial, sans-serif" class="float">
        ${formatNumber(data.totalContributions)}
      </text>
      
      <!-- Mini progress bar -->
      <rect x="20" y="110" width="160" height="8" rx="4" fill="#313244"/>
      <rect x="20" y="110" width="${totalWidth}" height="8" rx="4" fill="url(#contributionGradient)" class="progress-bar"/>
      <text x="${20 + totalWidth + 5}" y="117" fill="#8b949e" font-size="10" font-family="Arial, sans-serif">
      </text>
    </g>
    
    <!-- Current Streak Card -->
    <g class="slide-up" transform="translate(220, 0)" style="animation-delay: 0.1s">
      <rect width="200" height="130" rx="15" fill="#161b22" stroke="#30363d" stroke-width="1.5"/>
      <rect width="200" height="5" rx="15 15 0 0" fill="url(#streakGradient)"/>
      
      <use xlink:href="#icon-fire" x="20" y="35" width="28" height="28"/>
      <text x="56" y="54" fill="#8b949e" font-size="13" font-weight="600" font-family="Arial, sans-serif">
        Current Streak
      </text>
      <text x="100" y="95" text-anchor="middle" fill="#f0f6fc" font-size="34" font-weight="bold" font-family="Arial, sans-serif" class="float">
        ${data.currentStreak}
      </text>
      
      <!-- Streak indicator -->
      <rect x="20" y="110" width="160" height="8" rx="4" fill="#313244"/>
      <rect x="20" y="110" width="${currentWidth}" height="8" rx="4" fill="url(#streakGradient)" class="progress-bar"/>
      <text x="${20 + currentWidth + 5}" y="117" fill="#8b949e" font-size="10" font-family="Arial, sans-serif">
      </text>
    </g>
    
    <!-- Longest Streak Card -->
    <g class="slide-up" transform="translate(440, 0)" style="animation-delay: 0.2s">
      <rect width="200" height="130" rx="15" fill="#161b22" stroke="#30363d" stroke-width="1.5"/>
      <rect width="200" height="5" rx="15 15 0 0" fill="url(#recordGradient)"/>
      
      <use xlink:href="#icon-trophy" x="20" y="35" width="28" height="28"/>
      <text x="56" y="54" fill="#8b949e" font-size="13" font-weight="600" font-family="Arial, sans-serif">
        Longest Streak
      </text>
      <text x="100" y="95" text-anchor="middle" fill="#f0f6fc" font-size="34" font-weight="bold" font-family="Arial, sans-serif" class="float">
        ${data.longestStreak}
      </text>
      
      <!-- Record indicator -->
      <rect x="20" y="110" width="160" height="8" rx="4" fill="#313244"/>
      <rect x="20" y="110" width="${longestWidth}" height="8" rx="4" fill="url(#recordGradient)" class="progress-bar"/>
      <text x="${20 + longestWidth + 5}" y="117" fill="#8b949e" font-size="10" font-family="Arial, sans-serif">
      </text>
    </g>
  </g>
  
  <!-- Footer Info Section -->
  <g transform="translate(40, 260)" class="fade-in" style="animation-delay: 0.3s">
    <rect width="640" height="60" rx="12" fill="#161b22" stroke="#30363d" stroke-width="1.5"/>
    
    <!-- Activity Level -->
    <g>
      <use xlink:href="#icon-activity" x="25" y="18" width="24" height="24"/>
      <text x="55" y="35" fill="#8b949e" font-size="13" font-family="Arial, sans-serif">
        Activity Level:
      </text>
      <text x="140" y="35" fill="${getActivityColor()}" font-size="15" font-weight="bold" font-family="Arial, sans-serif">
        ${activityLevel}
      </text>
    </g>
    
    <!-- Last Updated -->
    <g transform="translate(220, 0)">
      <use xlink:href="#icon-calendar" x="25" y="18" width="24" height="24"/>
      <text x="55" y="35" fill="#8b949e" font-size="13" font-family="Arial, sans-serif">
        Last Updated:
      </text>
      <text x="145" y="35" fill="#f0f6fc" font-size="13" font-family="Arial, sans-serif">
        ${lastUpdated}
      </text>
    </g>
    
    <!-- Daily Average -->
    <g transform="translate(420, 0)">
      <circle cx="37" cy="30" r="10" fill="#2193b0" opacity="0.2"/>
      <text x="37" y="35" text-anchor="middle" fill="#2193b0" font-size="14" font-weight="bold" font-family="Arial, sans-serif">
        ${dailyAvg}
      </text>
      <text x="60" y="35" fill="#8b949e" font-size="13" font-family="Arial, sans-serif">
        Daily Avg
      </text>
    </g>
  </g>
  
  <!-- Animated border -->
  <rect x="10" y="10" width="700" height="320" rx="20" fill="none" stroke="url(#mainGradient)" stroke-width="2" stroke-dasharray="10,5" opacity="0.8">
    <animate attributeName="stroke-dashoffset" from="0" to="30" dur="2s" repeatCount="indefinite"/>
  </rect>
  
  <!-- Corner decorations -->
  <circle cx="20" cy="20" r="6" fill="#238636" opacity="0.6"/>
  <circle cx="700" cy="20" r="6" fill="#8957e5" opacity="0.6"/>
  <circle cx="20" cy="320" r="6" fill="#1f6feb" opacity="0.6"/>
  <circle cx="700" cy="320" r="6" fill="#FF416C" opacity="0.6"/>
</svg>`;

    res.send(svg);
  } catch (error) {
    console.error('SVG generation error:', error);
    const errorSvg = `
<svg width="720" height="200" viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="200" rx="15" fill="#0d1117"/>
  <text x="360" y="100" text-anchor="middle" fill="#f85149" font-size="18" font-family="Arial, sans-serif">
    Error generating GitHub stats
  </text>
</svg>`;
    res.status(500).setHeader("Content-Type", "image/svg+xml").send(errorSvg);
  }
});

/* =========================
   OTHER ROUTES (AFTER)
========================= */
router.get("/update/:username", async (req, res) => {
  const data = await fetchAndSaveGithubData(req.params.username);
  res.json(data);
});

router.get("/:username", getGithubAnalytics);

export default router;