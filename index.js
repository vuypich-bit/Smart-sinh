// index.js (Final Code: Re-introducing System Instruction)

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
                // ✅ ADDED: Restore Math Professor Role for high-quality math solution
                systemInstruction: "You are an expert Math Professor. Respond in clear LaTeX format, providing step-by-step solutions." 
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
                // ✅ ADDED: Restore Chat Assistant Role
                systemInstruction: "You are a friendly and helpful Math Assistant. Communicate clearly and use Khmer when responding to Khmer messages."
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
