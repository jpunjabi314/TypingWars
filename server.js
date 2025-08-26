// server.js (CommonJS version)
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");

const dotenv = require("dotenv");
dotenv.config();
console.log("🔑 Loaded key (first 5 chars):", process.env.OPENAI_API_KEY?.slice(0,5));



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend from /public
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/analyze-mistakes", async (req, res) => {
  try {
    const { mistakesLog } = req.body;


    if (!Array.isArray(mistakesLog)) {
      return res.status(400).json({ analysis: "Invalid mistakes data." });
    }

    // --- Fallback message if no mistakes ---
    if (mistakesLog.length === 0) {
      return res.json({ analysis: "No mistakes! Excellent typing! Keep it up!" });
    }

    // --- OpenAI API call ---
    const prompt = `
You are an AI typing tutor. A student made the following mistakes:
${JSON.stringify(mistakesLog, null, 2)}

Give a short, encouraging analysis and 1–2 actionable tips to improve.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful AI typing tutor." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    const analysis = data?.choices?.[0]?.message?.content || "Keep practicing!";

    res.json({ analysis });
  } catch (err) {
    console.error("Error in /analyze-mistakes:", err);
    res.status(500).json({ analysis: "Tutor unavailable. Keep practicing!" });
  }
});


app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
