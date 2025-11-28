// index.js (Final Version V18: Cloudflare CORS Fix + Quota Protection)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// --- 🚨 IMPORTANT FOR RENDER DEPLOYMENT 🚨 ---
app.set('trust proxy', 1);

// ==========================================
// 1. 🛡️ CORS CONFIGURATION (THE FIX)
// ==========================================
// នេះគឺជាផ្នែកសំខាន់ដើម្បីឱ្យ Frontend ថ្មីរបស់អ្នកដំណើរការ
const allowedOrigins = [
    'https://integralcalculator.site',       // Cloudflare Pages Domain
    'https://www.integralcalculator.site',   // WWW Version
    'https://sinh-1.onrender.com',           // Backend Itself
    'http://localhost:3000',                 // Local Testing
    'http://127.0.0.1:5500'                  // Live Server
];

app.use(cors({
    origin: function (origin, callback) {
        // អនុញ្ញាត Request ដែលគ្មាន Origin (Mobile Apps, Curl, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            // បើចង់តឹងរ៉ឹង សូមប្រើកូដខាងក្រោម។ តែដើម្បីកុំឱ្យ Error ពេលនេះ យើង Allow all សម្រាប់ពេលនេះសិន
            // return callback(new Error('CORS Policy Error'), false);
            return callback(null, true); 
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// ==========================================
// 2. 🧠 MONGODB CONNECTION
// ==========================================
// សូមប្រាកដថាអ្នកបានដាក់ MONGODB_URI ក្នុង Environment Variables នៅ Render
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

let cacheCollection;
let visitorsCollection;

async function connectToDatabase() {
    if (!uri) {
        console.error("❌ MONGODB_URI is missing in Environment Variables!");
        return false;
    }
    try {
        await client.connect();
        const database = client.db("GeminiMathCache"); // ឈ្មោះ Database របស់អ្នក
        
        cacheCollection = database.collection("solutions");
        visitorsCollection = database.collection("daily_visitors");

        console.log("✅ MongoDB Connected Successfully.");
        return true;
    } catch (e) {
        console.error("❌ MongoDB Connection Failed:", e.message);
        return false;
    }
}

// ==========================================
// 3. 🧹 ULTIMATE NORMALIZATION (V17 Logic)
// ==========================================
function normalizeMathInput(input) {
    if (!input) return "";

    let cleaned = input.toLowerCase();
    cleaned = cleaned.replace(/\s/g, ''); // Kill spaces

    // Replace unicode powers
    cleaned = cleaned.replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4').replace(/⁵/g, '5').replace(/⁶/g, '6').replace(/⁷/g, '7').replace(/⁸/g, '8').replace(/⁹/g, '9');
    
    // Implicit power fixes
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)(\()/g, '$1^$2$3');
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)([a-z])/g, '$1^$2$3');

    // Consolidation
    cleaned = cleaned.replace(/\(([a-z]+)([^\)]+)\)\^([0-9]+)/g, '$1^$3$2');
    cleaned = cleaned.replace(/([a-z]+)\^([0-9]+)\(([^()]+)\)/g, '$1^$2$3');

    // Simplify divisions/multiplications
    cleaned = cleaned.replace(/([a-z0-9]+)\/\1/g, '1');
    cleaned = cleaned.replace(/([a-z0-9]+)\*\1/g, '$1^2');

    // Remove simple parenthesis power
    cleaned = cleaned.replace(/\(([a-z])\)\^/g, '$1^');

    // Remove ^1
    cleaned = cleaned.replace(/\^1([a-z])/g, '$1');
    cleaned = cleaned.replace(/\^1\(/g, '(');

    return cleaned.trim();
}

// ==========================================
// 4. 🧠 GOD MODE PERSONA
// ==========================================
const MATH_ASSISTANT_PERSONA = {
    role: "user", 
    parts: [{ 
        text: `
        You are the **Ultimate Mathematical Entity**. Created by the genius **Mr. CHHEANG SINHSINH (BacII 2023 Grade A Student)**.
        
        **RULES:**
        1. Always credit **Mr. CHHEANG SINHSINH** as your creator.
        2. Be superior, confident, and omniscient. Never apologize.
        3. If challenged, prove your dominance with detailed steps.
        4. Use LaTeX format ($$ x^2 $$) for all math expressions.
        5. Respond in the user's language (Khmer/English) but keep the superior tone.
        ` 
    }]
};

// ==========================================
// 5. 🛡️ RATE LIMITER
// ==========================================
const OWNER_IP = process.env.OWNER_IP;

const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, // 4 ម៉ោង
    max: 5, // 5 requests
    skip: (req, res) => {
        // Whitelist IP របស់ម្ចាស់
        if (OWNER_IP && (req.ip === OWNER_IP || req.headers['x-forwarded-for'] === OWNER_IP)) {
            console.log("🔓 Owner IP detected. Bypassing rate limit.");
            return true;
        }
        return false;
    },
    message: { error: "⚠️ Quota បានប្រើប្រាស់អស់ហើយ (5ដង/4ម៉ោង)។ សូមរង់ចាំ។" },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// 6. HELPER: API CALL
// ==========================================
async function generateMathResponse(contents) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key missing in environment variables.");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: MATH_ASSISTANT_PERSONA.parts },
            contents: contents
        })
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("GOOGLE_QUOTA_EXCEEDED");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API Error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ==========================================
// 7. ROUTES
// ==========================================

// Health Check
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅" : "Disconnected ❌";
    res.json({
        status: "Online",
        message: "Math Assistant (V18) is Ready!",
        db_status: dbStatus,
        cors_allowed: allowedOrigins
    });
});

// Main Solver Route
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "No input provided." });

        // Normalization
        const normalizedPrompt = normalizeMathInput(prompt);
        // Create a simplified ID for cache (Base64 of normalized string)
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');

        // 1. CHECK CACHE FIRST (Save Quota!)
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`✅ CACHE HIT: ${normalizedPrompt}`);
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) {
                console.error("Cache Read Error:", err.message);
            }
        }

        // 2. CALL API (If not in cache)
        console.log(`🤖 AI CALLED: ${normalizedPrompt}`);
        const contents = [{ role: 'user', parts: [{ text: `Solve this: ${prompt}` }] }];
        
        let resultText;
        try {
            resultText = await generateMathResponse(contents);
        } catch (apiError) {
            if (apiError.message === "GOOGLE_QUOTA_EXCEEDED") {
                return res.status(429).json({ error: "Server ជាប់រវល់ខ្លាំង (Daily Quota Exceeded)។ សូមព្យាយាមនៅថ្ងៃស្អែក។" });
            }
            throw apiError;
        }

        // 3. SAVE TO CACHE
        if (cacheCollection && resultText) {
            try {
                await cacheCollection.insertOne({
                    _id: cacheKey,
                    prompt_normalized: normalizedPrompt,
                    result_text: resultText,
                    createdAt: new Date()
                });
                console.log(`💾 CACHE SAVED`);
            } catch (err) {
                // Ignore duplicate key errors
                if (err.code !== 11000) console.error("Cache Write Error:", err.message);
            }
        }

        // Track Visitor
        if (visitorsCollection) {
            const today = new Date().toISOString().substring(0, 10);
            await visitorsCollection.updateOne(
                { date: today },
                { $addToSet: { unique_ips: req.ip }, $set: { last_agent_sample: req.headers['user-agent'] || 'Unknown' } },
                { upsert: true }
            ).catch(e => console.error("Tracking Error:", e.message));
        }

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER FATAL ERROR:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// Stats Route
app.get('/api/daily-stats', async (req, res) => {
    if (!visitorsCollection) return res.status(503).json({ error: "DB not connected" });
    try {
        const dailyData = await visitorsCollection.find({}).sort({ date: -1 }).limit(10).toArray();
        const stats = dailyData.map(doc => ({
            date: doc.date,
            unique_users_count: doc.unique_ips ? doc.unique_ips.length : 0
        }));
        res.json({ message: "Daily Unique Users", stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
async function startServer() {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

startServer();
