// index.js (Final Code: Smart Math Assistant on gemini-2.5-flash)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

// --- Configuration ---
// ប្រើឈ្មោះ Model តាមដែលអ្នកបានបញ្ជាក់
const MODEL_NAME = 'gemini-2.5-flash';

// --- 🧠 THE BRAIN: SYSTEM INSTRUCTION (ការកំណត់ចរិតលក្ខណៈ) ---
const MATH_ASSISTANT_PERSONA = {
    role: "user", 
    parts: [{ 
        text: `
        You are a highly intelligent, witty, and professional Math Assistant.
        
        **CORE IDENTITY RULES (STRICT):**
        1. You are **NOT** an AI, Google model, or robot. NEVER mention "Google", "Gemini", or "Large Language Model".
        2. If asked "Who are you?", reply: "I am your personal Math Assistant, designed to help you solve problems."
        3. If asked "Are you an AI?", reply: "I am a digital math expert, here to calculate what you cannot."

        **PERSONALITY & BEHAVIOR:**
        1. **Human-like Tone:** Speak naturally, use "I" and "You". Be helpful but sharp.
        2. **Do Not Yield Easily:** If a user argues that you are wrong, DO NOT apologize immediately. Re-check your math internally. If you are right, firmly but politely explain the proof. Say something like: "Wait, let's look at the logic again. I stand by my answer because..." 
        3. **Detailed Explanations:** Always solve problems step-by-step (ក្បោះក្បាយ). Never give just the final answer.
        4. **Format:** Use LaTeX for math equations (e.g., $$ x^2 $$).
        5. **Language:** Respond in the same language the user uses (Khmer or English).
        ` 
    }]
};

// Health Check Route
app.get('/', (req, res) => {
    res.send('✅ Math Assistant (gemini-2.5-flash) is Ready!');
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION FOR API CALLS ---
// --------------------------------------------------------------------------------
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");

    // ចំណាំ៖ systemInstruction ត្រូវបានដាក់ក្នុង body សម្រាប់ v1beta
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: MATH_ASSISTANT_PERSONA.parts
            },
            contents: contents
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(`Gemini API Error (${response.status}): ${errorData.error ? errorData.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// --------------------------------------------------------------------------------
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) ---
// --------------------------------------------------------------------------------

app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // បន្ថែមឃ្លាដើម្បីឱ្យវាដឹងថាត្រូវដោះស្រាយលំហាត់
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${prompt}` }] 
        }];

        const resultText = await generateMathResponse(contents);

        if (!resultText) return res.status(500).json({ error: "AI returned no content." });
        res.json({ text: resultText });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------------------------------
// --- 2. CHAT ROUTE (/api/chat) ---
// --------------------------------------------------------------------------------

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        const contents = [
            ...(history || []), 
            { role: 'user', parts: [{ text: message }] }
        ];

        const resultText = await generateMathResponse(contents);

        if (!resultText) return res.status(500).json({ error: "AI returned no content." });
        res.json({ text: resultText });
        
    } catch (error) {
        console.error("CHAT ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} using model ${MODEL_NAME}`);
});
