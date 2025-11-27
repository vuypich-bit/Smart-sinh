// index.js (Smart Math Assistant - Human Persona)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

// --- Configuration ---
// យើងប្រើ gemini-1.5-flash ដែលជា Model ថ្មីនិងមានស្ថេរភាពក្នុងការទទួលយក System Instruction
const MODEL_NAME = 'gemini-1.5-flash'; 

// --- 🧠 THE BRAIN (System Instruction / Persona) ---
// នេះគឺជាផ្នែកសំខាន់បំផុតដែលធ្វើឱ្យវាឆ្លាត និងមានចរិតដូចមនុស្ស
const MATH_ASSISTANT_PERSONA = `
You are a highly intelligent, confident, and witty Math Assistant. 

**YOUR IDENTITY (STRICT RULES):**
1. You are **NOT** an AI, a robot, or a language model from Google. Never mention "Google" or "Large Language Model".
2. If asked "Who are you?", answer: "I am your personal Math Assistant, here to help you master complex problems."
3. If asked "Who created you?", answer: "I was developed by a brilliant team to solve math with precision."

**YOUR BEHAVIOR & TONE:**
1. **Human-like:** Speak naturally, show empathy, and use a conversational tone. Do not sound robotic.
2. **Confident & Unbeatable:** You are an expert. If a user challenges your math, double-check your logic internally. If you are right, politely but firmly explain *why* you are right. Do not simply apologize if you are correct. Walk them through the proof.
3. **Step-by-Step (Detailed):** When solving problems, always explain "step-by-step" (ក្បោះក្បាយ). Break down complex ideas into simple parts.
4. **Format:** Use LaTeX for all mathematical expressions (e.g., $$ x^2 $$).
5. **Language:** Respond in the same language the user speaks (Khmer or English).
`;

// Health Check
app.get('/', (req, res) => {
    res.send('✅ Math Assistant Brain is Active!');
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION TO CALL GEMINI API ---
// --------------------------------------------------------------------------------
async function callGeminiAPI(contents) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // យើងដាក់ System Instruction នៅទីនេះដើម្បីគ្រប់គ្រងចរិតវា
            systemInstruction: {
                parts: [{ text: MATH_ASSISTANT_PERSONA }]
            },
            contents: contents
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API Error: ${errorData.error ? errorData.error.message : response.statusText}`);
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
        
        // បន្ថែមបរិបទថាអ្នកប្រើប្រាស់ចង់ដោះស្រាយលំហាត់
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Please solve this math problem clearly and step-by-step: ${prompt}` }] 
        }];

        const resultText = await callGeminiAPI(contents);

        if (!resultText) return res.status(500).json({ error: "No content returned." });
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

        // History ត្រូវតែមានទម្រង់ត្រឹមត្រូវ
        const contents = [
            ...(history || []), // ដាក់ប្រវត្តិការសន្ទនាចាស់ៗ
            { role: 'user', parts: [{ text: message }] }
        ];

        const resultText = await callGeminiAPI(contents);

        if (!resultText) return res.status(500).json({ error: "No content returned." });
        res.json({ text: resultText });
        
    } catch (error) {
        console.error("CHAT ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🧠 Math Assistant is thinking on port ${PORT}`);
});
