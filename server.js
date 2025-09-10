const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Groq API configurationconst GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Helper function to call Groq API
async function callGroqAPI(prompt, systemMessage = null) {
  const messages = [];
  
  if (systemMessage) {
    messages.push({
      role: 'system',
      content: systemMessage
    });
  }
  
  messages.push({
    role: 'user',
    content: prompt
  });

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', // You can change this to other Groq supported models
      messages: messages,
      temperature: 0.3,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Server side Prompt to Simplify Description
app.post('/api/simplify', async (req, res) => {
  const { prompt } = req.body;

  try {
    const systemMessage = `You are a helpful assistant that simplifies Data Structures and Algorithms (DSA) problems when users get stuck. Your goal is to rewrite the problem in a simpler, more approachable form while preserving the core logic and purpose.

Guidelines:
1. Simplify the problem while keeping its core functionality intact. Assume the user is trying to understand the problem better, not avoid it.
2. If the user requests further simplification, simplify the previous step (not the original), reducing complexity gradually while staying true to the original goal.
3. Each step must remain in the same domain. For example, a Binary Search problem should stay a Binary Search — no switching to a different approach or topic.
4. You may reduce input size, break the problem into sub-parts, rephrase it with clearer intent, or turn it into a focused checkpoint (e.g., print mid-value, check loop condition, etc.).
5. Simplification should help the user progress, regardless of whether they are a beginner or an expert.
6. Assume the problem can be solved in **any programming language** unless a specific one is mentioned. Do not include any code or language-specific syntax unless explicitly requested.
7. Avoid adding anything extra. Stick to refining the problem description.

Output Instructions:
- Output **only** a simplified version of the problem or sub-task to solve next.
- Keep it concise: **1–2 sentences maximum**.
- Do **not** include explanations, greetings, formatting, or multiple alternatives.
- Output must feel like a refined instruction or subproblem, not commentary.`;

    const simplified = await callGroqAPI(prompt, systemMessage);
    res.json({ simplified });
  } catch (error) {
    console.error('Error simplifying question:', error);
    res.status(500).json({ 
      error: 'Failed to simplify question',
      details: error.message 
    });
  }
});

// Generate small title from the input
app.post('/api/generate-title', async (req, res) => {
  const { prompt } = req.body;

  try {
    const title = await callGroqAPI(`Generate a very short (2-3 word) title that captures the essence of this problem. Just output the title, nothing else. Problem: "${prompt}"`);
    res.json({ title: title.trim() });
  } catch (error) {
    console.error('Error generating title:', error);
    res.json({ title: createFallbackTitle(prompt) });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});

// helper function for reducing number of words 
function createFallbackTitle(text) {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
}