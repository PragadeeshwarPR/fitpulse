// Vercel serverless entry: wraps the compiled Express app (built to dist/ by `vercel-build`).
import { createApp } from "../dist/app.js";

export default createApp();
