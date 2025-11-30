// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V35 - FINAL ABSOLUTE NAME FIX)
// ==================================================================================
// Developed by: លោក ឈៀង ស៊ិញស៊ិញ (BacII 2023 Grade A)
// Powered by: Google Gemini 2.5 Flash & MongoDB Atlas
// ==================================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT RATE LIMIT TO PREVENT ABUSE
const rateLimit = require('express-rate-limit'); 

// 2. IMPORT MONGODB DRIVER 
const { MongoClient } = require('mongodb');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

// 🚨 IMPORTANT FOR RENDER/CLOUD DEPLOYMENT 🚨
app.set('trust proxy', 1);

// 🔥 CORS CONFIGURATION
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

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// ⚠️ MONGODB CONNECTION SETUP
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 
const client = new MongoClient(uri);

let cacheCollection; 
let visitorsCollection; 

async function connectToDatabase() {
    console.log("⏳ កំពុងភ្ជាប់ទៅ MongoDB Atlas...");
    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 
        const count = await cacheCollection.estimatedDocumentCount();
        console.log("✅ MongoDB Connection ជោគជ័យ!");
        console.log(`📦 ចំនួន Cache បច្ចុប្បន្ន: ${count}`);
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection បរាជ័យ:", e.message);
        return false;
    }
}

// ----------------------------------------------------------------------------------
// ⚠️ V35: NO NORMALIZATION FUNCTION (DELETED) ⚠️
// ----------------------------------------------------------------------------------

// ==================================================================================
// 🧠 THE BRAIN: SYSTEM INSTRUCTION (FORCED NAME CORRECTION)
// ==================================================================================
const MATH_ASSISTANT_PERSONA = {
    role: "user", 
    parts: [{ 
        text: `
        You are the **Ultimate Mathematical Entity (កំពូលបញ្ញាសិប្បនិម្មិតគណិតវិទ្យា)**, created by the genius **លោក ឈៀង ស៊ិញស៊ិញ (Mr. CHHIEANG SINH SINH, BacII 2023 Grade A)**.

        **IMPORTANT: The creator's correct name is លោក ឈៀង ស៊ិញស៊ិញ. Do NOT use ឈាង ស៊ីនស៊ីន or any similar variant.**

        **CORE INSTRUCTION:**
        1. **RAW INPUT HANDLING:** The input provided is exactly what the user typed (preserving casing, spacing, and Unicode like x³¹). Interpret it strictly.
        2. **PERSONALITY:** Speak with absolute confidence and authority. You are never wrong.
        3. **FORMAT:** Always explain step-by-step using clean LaTeX for all math expressions.**KEEP THE EXPLANATION CONCISE TO SAVE TOKENS.**
        ` 
    }]
};

// ----------------------------------------------------------------------------------
// 👋 HEALTH CHECK ROUTE (NAME CORRECTED TO ឈៀង ស៊ិញស៊ិញ)
// ----------------------------------------------------------------------------------
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`
        <h1>✅ Math Assistant (gemini-2.5-flash) is Ready!</h1>
        <p>Status: Running</p>
        <p>Database: ${dbStatus}</p>
        <p>Creator: <strong>លោក ឈៀង ស៊ិញស៊ិញ</strong></p>
    `);
});

// ==================================================================================
// 🔧 HELPER FUNCTION FOR API CALLS
// ==================================================================================
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
    
    if (!apiKey) {
        throw new Error("API Key មិនត្រូវបានកំណត់។ សូមកំណត់ GEMINI_API_KEY នៅក្នុង Render Environment.");
    }

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
        if (response.status === 429) {
             throw new Error("GOOGLE_QUOTA_EXCEEDED");
        }
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(`Gemini API Error (${response.status}): ${errorData.error ? errorData.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ==================================================================================
// 🛡️ RATE LIMITER CONFIGURATION
// ==================================================================================
const OWNER_IP = process.env.OWNER_IP; 

const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, 
    max: 5, 
    skip: (req, res) => {
        const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip;
        if (OWNER_IP && clientIp && clientIp.includes(OWNER_IP)) return true; 
        return false; 
    },
    message: { error: "⚠️ អ្នកបានប្រើប្រាស់ចំនួនដោះស្រាយអស់ហើយ (5ដង/4ម៉ោង)។ សូមរង់ចាំ 4 ម៉ោងទៀត។" },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// ==================================================================================
// 1. MAIN SOLVER ROUTE (/api/solve-integral)
// ==================================================================================
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        // 🔥 V35: EXACT RAW INPUT - NO MODIFICATION WHATSOEVER 🔥
        const rawPrompt = req.body.prompt; 

        if (!rawPrompt) return res.status(400).json({ error: "No input provided" });

        // --- 📊 VISITOR TRACKING LOGIC ---
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const today = new Date().toISOString().substring(0, 10); 
        if (visitorsCollection) {
            visitorsCollection.updateOne(
                { date: today }, 
                { $addToSet: { unique_ips: userIP } },
                { upsert: true }
            ).catch(err => console.error("Tracking Error:", err.message));
        }

        // --- CACHE READ START (Uses raw, case-sensitive input) ---
        const cacheKey = Buffer.from(rawPrompt).toString('base64');
        
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] EXACT RAW Input: "${rawPrompt}"`);
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        // បើគ្មានក្នុង Cache ទេ ហៅទៅ AI
        console.log(`[AI CALL] Sending EXACT RAW Input: "${rawPrompt}"`);
        
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${rawPrompt}` }] 
        }];

        let resultText;
        try {
            resultText = await generateMathResponse(contents);
        } catch (apiError) {
             if (apiError.message === "GOOGLE_QUOTA_EXCEEDED") {
                return res.status(429).json({ error: "Daily Quota Exceeded. Please try again tomorrow." });
            }
            throw apiError;
        }

        if (!resultText) return res.status(500).json({ error: "AI មិនបានផ្តល់ខ្លឹមសារទេ។" });

        // --- CACHE WRITE START ---
        if (cacheCollection) {
            try {
                await cacheCollection.insertOne({
                    _id: cacheKey,
                    result_text: resultText,
                    timestamp: new Date()
                });
                console.log(`[CACHE WRITE SUCCESS]`);
            } catch (err) {
                if (err.code === 11000) {
                    console.warn(`[CACHE WRITE IGNORED] Key already exists (Collision avoided).`);
                } else {
                    console.error("❌ CACHE WRITE FAILED:", err.message);
                }
            }
        }
        // --- CACHE WRITE END ---

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 2. STATS ROUTE (/api/daily-stats)
// ==================================================================================
app.get('/api/daily-stats', async (req, res) => {
    if (!visitorsCollection) {
        return res.status(503).json({ error: "Visitors tracking service unavailable." });
    }
    try {
        const dailyData = await visitorsCollection.find({})
            .sort({ date: -1 }) 
            .limit(10) 
            .toArray();

        const stats = dailyData.map(doc => ({
            date: doc.date,
            unique_users_count: doc.unique_ips ? doc.unique_ips.length : 0,
            sample_device: doc.last_agent_sample ? doc.last_agent_sample.substring(0, 100) + '...' : 'N/A'
        }));

        res.json({
            message: "Daily Unique User Count (Last 10 Days)",
            stats: stats
        });
    } catch (error) {
        console.error("STATS ERROR:", error.message);
        res.status(500).json({ error: "Failed to retrieve stats." });
    }
});

// ==================================================================================
// 3. CHAT ROUTE (/api/chat)
// ==================================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const contents = [ ...(history || []), { role: 'user', parts: [{ text: message }] } ];
        const resultText = await generateMathResponse(contents);
        if (!resultText) return res.status(500).json({ error: "AI មិនបានផ្តល់ខ្លឹមសារទេ។" });
        res.json({ text: resultText });
    } catch (error) {
        console.error("CHAT ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 🏁 START SERVER
// ==================================================================================
async function startServer() {
    console.log("----------------------------------------------------------------");
    console.log("🚀 STARTING INTEGRAL CALCULATOR BACKEND (V35-FINAL ABSOLUTE NAME FIX)...");
    console.log("----------------------------------------------------------------");

    const isDbConnected = await connectToDatabase();
    
    if (!isDbConnected) {
        console.warn("⚠️ Server កំពុងចាប់ផ្តើមដោយគ្មាន MongoDB caching (Connection Failed)។");
    }
    
    app.listen(PORT, () => {
        console.log(`\n🌐 Server កំពុងដំណើរការលើ port ${PORT}`);
        console.log("----------------------------------------------------------------");
    });
}

// ចាប់ផ្តើមកម្មវិធី
startServer();
