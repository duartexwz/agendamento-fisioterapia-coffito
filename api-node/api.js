import { app } from './app/app.js';

// Vercel expects a function that receives (req, res)
export default function handler(req, res) {
  return app(req, res);
}
