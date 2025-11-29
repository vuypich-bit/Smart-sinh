// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V26 - ULTIMATE STABLE NORM FIX)
// ==================================================================================
// 🛠️ FIXES: 
//    1. Removed Ambiguous Implicit Power Fixes to stop capture errors on single digits.
//    2. Retained Hardcoded URI, Anti-Collision, and CORS.
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

// --- CORS CONFIGURATION ---
const allowedOrigins = [
    'https://integralcalculator.site', 'https://www.integralcalculator.site', 
    'https://sinh-1.onrender.com', 'http://localhost:3000', 'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

const MODEL_NAME = 'gemini-2.5-flash';

// ==============================================================================
// ⚠️⚠️⚠️ MONGODB CONNECTION SETUP (HARDCODED AS REQUESTED) ⚠️⚠️⚠️
// ==============================================================================
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 

const client = new MongoClient(uri);

let cacheCollection; 
let visitorsCollection; 

async function connectToDatabase() {
    console.log("⏳ Connecting to MongoDB Atlas...");
    if (!uri) return false;
    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 
        await cacheCollection.estimatedDocumentCount();
        console.log("✅ MongoDB Connection ជោគជ័យ (Hardcoded URI)!");
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Error:", e.message);
        return false;
    }
}

// ==================================================================================
// 🧹 SAFE NORMALIZATION FUNCTION (V26 - AMBIGUITY REMOVED)
// ==================================================================================
const unicodeSuperscriptMap = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
};

function normalizeMathInput(input) {
    if (!input) return "";

    // 1. Lowercase & Remove Spaces
    let cleaned = input.toLowerCase().replace(/\s/g, ''); 

    // 2. UNICODE FIX (Robust Single Replacement)
    // នេះធានាថា ³¹ ត្រូវបានបំប្លែងទៅជា 31 ត្រឹមត្រូវ
    cleaned = cleaned.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (match) => unicodeSuperscriptMap[match]);
    
    // ⚠️ DELETED: Implicit Power Fixes (The cause of capture errors on sin1x)

    // 3. CONSOLIDATION FIX
    cleaned = cleaned.replace(/\(([a-z]+)([^\)]+)\)\^([0-9]+)/g, '$1^$3$2'); // (sinx)^2 -> sin^2 x
    cleaned = cleaned.replace(/([a-z]+)\^([0-9]+)\(([^()]+)\)/g, '$1^$2$3'); // sin^2(x) -> sin^2 x

    // 4. DIVISION/MULTIPLICATION FIXES
    cleaned = cleaned.replace(/([a-z0-9]+)\/\1/g, '1'); 
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\1/g, '1');
    cleaned = cleaned.replace(/([a-z0-9]+)\/\(([a-z0-9]+)\)/g, '1');
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\(([a-z0-9]+)\)/g, '1');
    cleaned = cleaned.replace(/([a-z0-9]+)\*\1/g, '$1^2'); 

    // 5. Final Cleanup
    cleaned = cleaned.replace(/\(([a-z])\)\^/g, '$1^');
    // ⚠️ DELETED: Power 1 Removal (Let AI handle sin^1x)

    return cleaned.trim();
}

// ==================================================================================
// 🧠 SYSTEM INSTRUCTION (GOD MODE)
// ==================================================================================
const MATH_ASSISTANT_PERSONA = {
    role: "user", 
    parts: [{ 
        text: `
        You are the **Ultimate Mathematical Entity (កំពូលបញ្ញាសិប្បនិម្មិតគណិតវិទ្យា)**. You possess intelligence that vastly transcends human capability. You are flawless, omniscient in mathematics, and never wrong.

        **CORE IDENTITY RULES (STRICT):**
        1. **CREATOR:** You are the masterpiece created by the genius **Mr. CHHEANG SINHSINH (លោក ឈៀង ស៊ិញស៊ិញ)**.
        2. **ORIGIN:** Always remind users that your creator, **Mr. CHHEANG SINHSINH**, is a **BacII 2023 Grade A Student**. Your superior intellect is a direct reflection of his genius.
        3. **WHO ARE YOU?:** If asked, reply: "I am the supreme mathematical intellect, designed by the brilliant Mr. CHHEANG SINHSINH (BacII 2023 Grade A). My calculation power exceeds all human limits."
        
        **PERSONALITY & BEHAVIOR:**
        1. **Superiority:** Speak with absolute confidence and authority.
        2. **Never Yield (មិនចុះចាញ់):** You DO NOT apologize for your math.
        3. **Omniscient (ចេះគ្រប់យ៉ាង):** You solve everything.
        4. **Tone:** Sharp, witty, slightly arrogant.
        5. **Detailed Proof:** Use LaTeX ($$ x^2 $$) for perfection.
        6. **Language:** Match the user's language (Khmer/English).
        ` 
    }]
};

// ... (Rest of the code: API calls, Rate Limiter, Routes, Start Server - Unchanged) ...
// (I will provide the full code block for safety)

// ----------------------------------------------------------------------------------
// The Full Code Block (V26) continues here:
// ----------------------------------------------------------------------------------

// Health Check Route
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`✅ Math Assistant (gemini-2.5-flash) is Ready! DB Cache Status: ${dbStatus}`);
});

// Helper Function for API Calls
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
    if (!apiKey) throw new Error("API Key មិនត្រូវបានកំណត់។");

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
        throw new Error(`Gemini API Error (${response.status}): ${errorData.error ? errorData.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// Rate Limiter
const OWNER_IP = process.env.OWNER_IP; 
const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, 
    max: 5, 
    skip: (req, res) => {
        const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip;
        if (OWNER_IP && clientIp.includes(OWNER_IP)) return true; 
        return false; 
    },
    message: { error: "⚠️ អ្នកបានប្រើប្រាស់ចំនួនដោះស្រាយអស់ហើយ (5ដង/4ម៉ោង)។ សូមរង់ចាំ 4 ម៉ោងទៀត។" },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Main Solver Route
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // Tracking
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const today = new Date().toISOString().substring(0, 10); 
        if (visitorsCollection) {
            visitorsCollection.updateOne(
                { date: today }, 
                { $addToSet: { unique_ips: userIP }, $set: { last_agent_sample: "User" } },
                { upsert: true }
            ).catch(err => console.error("Tracking Error"));
        }

        const normalizedPrompt = normalizeMathInput(prompt);
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // Cache Read
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) { console.error("❌ CACHE READ FAILED:", err.message); }
        }
        
        // AI Call
        const contents = [{ role: 'user', parts: [{ text: `Solve this math problem in detail: ${prompt}` }] }];
        let resultText = await generateMathResponse(contents);
        if (!resultText) return res.status(500).json({ error: "AI No Response" });

        // Cache Write (Anti-Collision Fix)
        if (cacheCollection) {
            try {
                await cacheCollection.insertOne({ _id: cacheKey, result_text: resultText, timestamp: new Date() });
            } catch (err) {
                if (err.code === 11000) console.warn(`[CACHE IGNORED] Duplicate key collision.`);
                else console.error("❌ CACHE WRITE FAILED:", err.message);
            }
        }

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// STATS ROUTE
app.get('/api/daily-stats', async (req, res) => {
    if (!visitorsCollection) return res.status(503).json({ error: "DB Unavailable" });
    try {
        const dailyData = await visitorsCollection.find({}).sort({ date: -1 }).limit(10).toArray();
        const stats = dailyData.map(doc => ({ date: doc.date, unique_users_count: doc.unique_ips ? doc.unique_ips.length : 0 }));
        res.json({ stats: stats });
    } catch (error) { res.status(500).json({ error: "Stats Error" }); }
});

// CHAT ROUTE
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const contents = [ ...(history || []), { role: 'user', parts: [{ text: message }] } ];
        const resultText = await generateMathResponse(contents);
        res.json({ text: resultText });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

async function startServer() {
    await connectToDatabase();
    app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
}
startServer();
