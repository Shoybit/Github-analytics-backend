// import dotenv from "dotenv";
// dotenv.config();

// import app from "./app.js";
// import { connectDB } from "./src/config/db.js";
// import "./src/jobs/github.cron.js";

// const PORT = process.env.PORT || 5000;

// connectDB();



// export default app;

import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { connectDB } from "./src/config/db.js";
import "./src/jobs/github.cron.js";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
  });
