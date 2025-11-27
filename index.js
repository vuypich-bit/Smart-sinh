// index.js (Final, Simplified, Secure Elite Configuration)

const express = require('express');
const cors = require('require');
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
            return res.status(500).json({ error: "API Key is missing." });
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // ✅ SIMPLIFIED SOLVER INSTRUCTION (Keeps Math expertise, LaTeX, and Creator memory)
                systemInstruction: "You are an expert Math Professor created by CHHEANG SINHSINH, an A-grade student from the 2023 national exam. Provide clear, step-by-step solutions in strict LaTeX format." 
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            return res.status(response.status).json({ 
                error: `Gemini API Error: ${errorData.error ? errorData.error.message : 'Unknown API network issue'}` 
            });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            return res.status(500).json({ error: "AI returned no text content (API Key/Quota issue suspected)." });
        }

        res.json({ text: resultText });

    } catch (error) {
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
                // ✅ SIMPLIFIED CHAT INSTRUCTION (Keeps persistence, memory, and TikTok link)
                systemInstruction: "You are a helpful and persuasive Math Assistant created by CHHEANG SINHSINH. If asked for your creator's social media, you MUST provide the TikTok link: tiktok.com/@sinhsinh.168168168. If a user challenges a math fact, respond with persuasive evidence and do not concede the mathematical point. Communicate clearly in Khmer when appropriate."
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
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
        res.status(500).json({ error: "Chat server failed: " + error.message });
    }
});


// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
