// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V27 - CASE INSENSITIVE MODE)
// ==================================================================================
// Developed by: Mr. CHHEANG SINHSINH (BacII 2023 Grade A)
// Powered by: Google Gemini 2.5 Flash & MongoDB Atlas
// ==================================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit'); 
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.set('trust proxy', 1);

// ==================================================================================
// 🔥 CORS CONFIGURATION
// ==================================================================================
app.use(cors({
    origin: function (origin, callback) {
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// ==================================================================================
// ⚠️ MONGODB CONNECTION
// ==================================================================================
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 
const client = new MongoClient(uri);

let cacheCollection; 
let visitorsCollection; 

async function connectToDatabase() {
    console.log("⏳ Connecting to MongoDB...");
    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 
        const count = await cacheCollection.estimatedDocumentCount();
        console.log(`✅ MongoDB Connected! Cache Count: ${count}`);
        return true;
    } catch (e) {
        console.error("❌ MongoDB Error:", e.message);
        return false;
    }
}

// ==================================================================================
// 🧹 MINIMAL NORMALIZATION FUNCTION (CASE INSENSITIVE KEY)
// ==================================================================================
// មុខងារនេះត្រូវបានប្រើដើម្បីធានាថា "SIN(x)" និង "sin(x)" មាន Cache Key ដូចគ្នា
function normalizeMathInput(input) {
    if (!input) return "";

    // 1. ប្តូរទៅជាអក្សរតូចទាំងអស់ (Case Insensitivity)
    let cleaned = input.toLowerCase(); 
    
    // 2. លុបចន្លោះខាងដើមនិងខាងចុង (Trim)
    cleaned = cleaned.trim();

    // ⚠️ ចំណាំ៖ មិនមាន Regex កែលេខស្វ័យគុណដូចកូដ V23 ទៀតទេ!
    
    return cleaned;
}

// ==================================================================================
// 🧠 SYSTEM INSTRUCTION
// ==================================================================================
const MATH_ASSISTANT_PERSONA = {
    role: "user", 
    parts: [{ 
        text: `
        You are the **Ultimate Mathematical Entity**. Created by **Mr. CHHEANG SINHSINH (BacII 2023 Grade A)**.
        
        **RULES:**
        1. **CASE INSENSITIVITY:** The input may have mixed casing (e.g., Sin vs sin). Treat all mathematical variables and functions as case-insensitive.
        2. **UNICODE EXPONENTS:** x²¹ is x^21. Do not simplify it.
        3. **OUTPUT:** Use LaTeX for math. Explain step-by-step.
        ` 
    }]
};

// ==================================================================================
// 🔧 HELPER FUNCTION (GEMINI API)
// ==================================================================================
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
    
    if (!apiKey) throw new Error("API Key Missing");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: MATH_ASSISTANT_PERSONA.parts },
            contents: contents
        })
    });

    if (!response.ok) {
        if (response.status === 429) throw new Error("GOOGLE_QUOTA_EXCEEDED");
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(`Gemini API Error: ${errorData.error?.message || response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ==================================================================================
// 🛡️ RATE LIMITER
// ==================================================================================
const OWNER_IP = process.env.OWNER_IP; 
const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, 
    max: 5, 
    skip: (req, res) => {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        if (OWNER_IP && clientIp.includes(OWNER_IP)) return true; 
        return false; 
    },
    message: { error: "⚠️ Quota Exceeded (5 req / 4 hours)." },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// ==================================================================================
// 1. MAIN SOLVER ROUTE (CASE INSENSITIVE)
// ==================================================================================
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body; 

        if (!prompt) return res.status(400).json({ error: "No input provided" });

        // --- 📊 TRACKING ---
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const today = new Date().toISOString().substring(0, 10); 
        if (visitorsCollection) {
            visitorsCollection.updateOne({ date: today }, { $addToSet: { unique_ips: userIP } }, { upsert: true }).catch(console.error);
        }

        // 🔥 NORMALIZE INPUT (Lowercase + Trim) 🔥
        // ឧទាហរណ៍៖ "  SIN(x)  " នឹងក្លាយជា "sin(x)"
        const normalizedPrompt = normalizeMathInput(prompt);

        // --- CACHE (Using Normalized Key) ---
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        if (cacheCollection) {
            const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
            if (cachedResult) {
                console.log(`[CACHE HIT] Normalized Input: "${normalizedPrompt}"`);
                return res.json({ text: cachedResult.result_text, source: "cache" });
            }
        }
        
        // --- AI CALL ---
        // យើងផ្ញើ input ដែលបាន Normalize (Lowercase) ទៅ AI
        console.log(`[AI CALL] Sending Normalized Input: "${normalizedPrompt}"`);
        
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this: ${normalizedPrompt}` }] 
        }];

        let resultText;
        try {
            resultText = await generateMathResponse(contents);
        } catch (apiError) {
             if (apiError.message === "GOOGLE_QUOTA_EXCEEDED") return res.status(429).json({ error: "Daily Quota Exceeded." });
            throw apiError;
        }

        if (!resultText) return res.status(500).json({ error: "AI returned empty response." });

        // --- SAVE TO CACHE ---
        if (cacheCollection) {
            // សន្សំដោយប្រើ key ពី normalizedPrompt
            cacheCollection.insertOne({ _id: cacheKey, result_text: resultText, timestamp: new Date() }).catch(() => {});
        }

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 2. STATS & CHAT ROUTES
// ==================================================================================
app.get('/api/daily-stats', async (req, res) => {
    if (!visitorsCollection) return res.status(503).json({ error: "DB Unavailable" });
    const dailyData = await visitorsCollection.find({}).sort({ date: -1 }).limit(10).toArray();
    res.json({ stats: dailyData.map(d => ({ date: d.date, count: d.unique_ips?.length || 0 })) });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const contents = [ ...(history || []), { role: 'user', parts: [{ text: message }] } ];
        const resultText = await generateMathResponse(contents);
        res.json({ text: resultText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 🏁 START SERVER
// ==================================================================================
async function startServer() {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 Server V27 (CASE INSENSITIVE) running on port ${PORT}`);
    });
}

startServer();
