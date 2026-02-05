import cron from "node-cron";
import { fetchAndSaveGithubData } from "../controllers/github.controller.js";

cron.schedule("0 */6 * * *", async () => {
  console.log("⏱️ GitHub analytics updating...");
  await fetchAndSaveGithubData("shoybit"); 
});
