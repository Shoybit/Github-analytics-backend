import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { connectDB } from "./src/config/db.js";
import "./src/jobs/github.cron.js";

const PORT = process.env.PORT || 5000;

connectDB();



export default app;