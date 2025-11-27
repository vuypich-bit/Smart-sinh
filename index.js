// index.js (Final Code: Smart Math Assistant with Guaranteed MongoDB Connection)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT MONGODB DRIVER 
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// --- 🧠 MONGODB CONNECTION SETUP ---
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

let cacheCollection; 

// ផ្លាស់ប្តូរទៅជា Async Function ដើម្បីរង់ចាំ Connection
async function connectToDatabase() {
    if (!uri) {
        console.warn("⚠️ MONGODB_URI is missing. Caching will be disabled.");
        return false;
    }
    try {
        // រង់ចាំការតភ្ជាប់ client
        await client.connect(); 
        
        // --- IMPORTANT CHANGE: ប្រើ Database Name ថ្មី (GeminiMathCache) ---
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        
        // ផ្ទៀងផ្ទាត់ការតភ្ជាប់
        await cacheCollection.estimatedDocumentCount();

        console.log("✅ MongoDB Connection Successful. Cache Ready.");
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection Failed. Caching Disabled. Check URI/Password/Network Access.", e.message);
        cacheCollection = null; 
        return false;
    }
}

// --- 🧠 THE BRAIN: SYSTEM INSTRUCTION (unchanged) ---
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
    // បង្ហាញสถานៈច្បាស់លាស់នៅលើ Health Check
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`✅ Math Assistant (gemini-2.5-flash) is Ready! DB Cache Status: ${dbStatus}`);
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION FOR API CALLS (unchanged) ---
// --------------------------------------------------------------------------------
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");

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
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) WITH CACHE (unchanged logic) ---
// --------------------------------------------------------------------------------

app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // 1. បង្កើត Base64 Key សម្រាប់ MongoDB
        const normalizedPrompt = prompt.toLowerCase().trim().replace(/\s+/g, ' ');
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // --- CACHE READ START ---
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] Found result for: "${normalizedPrompt.substring(0, 20)}..."`);
                    return res.json({ text: cachedResult.result_text });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        console.log(`[AI CALL] Calling Gemini for: "${normalizedPrompt.substring(0, 20)}..."`);
        
        // បន្ថែមឃ្លាដើម្បីឱ្យវាដឹងថាត្រូវដោះស្រាយលំហាត់
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${prompt}` }] 
        }];

        // 2. ហៅ AI (ប្រសិនបើគ្មានក្នុង Cache)
        const resultText = await generateMathResponse(contents);

        if (!resultText) return res.status(500).json({ error: "AI returned no content." });

        // --- CACHE WRITE START ---
        if (cacheCollection) {
            try {
                // ប្រើ CacheKey ដែលបាន Normalize
                await cacheCollection.insertOne({
                    _id: cacheKey,
                    result_text: resultText,
                    timestamp: new Date()
                });
                console.log(`[CACHE WRITE SUCCESS] Saved result for: "${normalizedPrompt.substring(0, 20)}..."`);
            } catch (err) {
                // ភាគច្រើន Error នេះគឺដោយសារតែ Duplicate Key ឬ DB Connection error
                if (err.code !== 11000) { // 11000 = Duplicate Key Error (which is OK)
                    console.error("❌ CACHE WRITE FAILED (Non-Fatal):", err.message);
                }
            }
        }
        // --- CACHE WRITE END ---

        res.json({ text: resultText });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------------------------------
// --- 2. CHAT ROUTE (/api/chat) (unchanged) ---
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


// --------------------------------------------------------------------------------
// --- STARTUP FUNCTION (unchanged) ---
// --------------------------------------------------------------------------------

async function startServer() {
    const isDbConnected = await connectToDatabase();
    
    // បើ DB Connection បរាជ័យ នោះវានៅតែអាចរត់បាន ប៉ុន្តែគ្មាន Cache ទេ
    if (!isDbConnected) {
        console.warn("Server starting without MongoDB caching.");
    }
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} using model ${MODEL_NAME}`);
        console.log(`Access the App at: https://smart-sinh-i.onrender.com`);
    });
}

startServer();
