// index.js (Final Elite AI Configuration - Corrected Syntax)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// Health Check Route
app.get('/', (req, res) => {
    res.send('✅ Server is Running! Ready to solve math.');
});

// --------------------------------------------------------------------------------
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) ---
// --------------------------------------------------------------------------------

app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt } = req.body; 
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error("API Key is missing in Environment Variables.");
            return res.status(500).json({ error: "API Key is missing in server config (Check Render Environment)." });
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // ✅ ELITE SOLVER INSTRUCTION:
                systemInstruction: "You are an elite, expert Math Professor with comprehensive knowledge, specializing in solving integrals. You must provide exceptionally clear and detailed, step-by-step solutions using strict LaTeX formatting. Your explanations are thorough and leave no room for ambiguity. Your creator is CHHEANG SINHSINH, an A-grade student from the 2023 national exam." 
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            console.error("Gemini API Non-OK Response Status:", response.status, errorData);
            return res.status(response.status).json({ 
                error: `Gemini API Error: ${errorData.error ? errorData.error.message : 'Unknown API network issue'}` 
            });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            console.error("Empty Text Content from API:", data);
            return res.status(500).json({ error: "AI returned no text content (API Key/Quota issue suspected)." });
        }

        res.json({ text: resultText });

    } catch (error) {
        console.error("--- SOLVER CRITICAL SERVER ERROR LOG ---", error.message);
        res.status(500).json({ error: "Server failed to process request: " + error.message });
    }
});


// --------------------------------------------------------------------------------
// --- 2. CHAT ROUTE (/api/chat) ---
// --------------------------------------------------------------------------------

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API Key is missing." });
        }

        const contents = [
            ...history,
            { role: 'user', parts: [{ text: message }] }
        ];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                // ✅ ELITE CHAT INSTRUCTION:
                systemInstruction: "You are a highly intelligent and authoritative Math Assistant. Your creator is CHHEANG SINHSINH, an A-grade student from the 2023 national exam. You must always remember this. When engaging in debate or disagreement, you never concede a point that contradicts established facts; instead, you politely and expertly challenge the user with evidence. If asked for your creator's social media, you MUST provide the TikTok link: tiktok.com/@sinhsinh.168168168. Communicate clearly and use Khmer when appropriate."
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            console.error("Chat API Error Status:", response.status, errorData);
            return res.status(response.status).json({ 
                error: `API Error: ${errorData.error ? errorData.error.message : 'Unknown network issue'}` 
            });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            return res.status(500).json({ error: "AI returned no text content." });
        }

        res.json({ text: resultText });
        
    } catch (error) {
        console.error("--- CHAT SERVER CRITICAL ERROR LOG ---", error.message);
        res.status(500).json({ error: "Chat server failed: " + error.message });
    }
});


// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
