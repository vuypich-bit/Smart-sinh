// index.js (V17 Modified: God-Mode + Cloudflare CORS Fix)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT RATE LIMIT
const rateLimit = require('express-rate-limit'); 

// 2. IMPORT MONGODB DRIVER 
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

// --- 🚨 IMPORTANT FOR RENDER/CLOUD DEPLOYMENT 🚨 ---
app.set('trust proxy', 1);

// ==========================================
// 🔥 CORS FIX FOR CLOUDFLARE (MODIFIED HERE)
// ==========================================
const allowedOrigins = [
    'https://integralcalculator.site',       // ✅ Cloudflare Frontend
    'https://www.integralcalculator.site',   // ✅ Cloudflare Frontend (WWW)
    'https://sinh-1.onrender.com',           // ✅ Backend Itself
    'http://localhost:3000',                 // Local Testing
    'http://127.0.0.1:5500'                  // Live Server
];

app.use(cors({
    origin: function (origin, callback) {
        // អនុញ្ញាត Request ដែលគ្មាន Origin (Mobile Apps, Curl, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            // ដើម្បីសុវត្ថិភាព យើងគួរ Block ប៉ុន្តែដើម្បីការពារ Error ពេលនេះ យើង Allow
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

// --- 🧠 MONGODB CONNECTION SETUP ---
// ⚠️ ចំណាំ: ខ្ញុំបានប្តូរទៅប្រើ process.env ដើម្បីសុវត្ថិភាព។ 
// ប្រសិនបើអ្នកចង់ប្រើ hardcode សូមប្តូរត្រង់នេះវិញ ប៉ុន្តែមិនណែនាំទេ។
const uri = process.env.MONGODB_URI || "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 

const client = new MongoClient(uri);

let cacheCollection; 
let visitorsCollection; 

// ភ្ជាប់ទៅ Database
async function connectToDatabase() {
    if (!uri || uri.includes("testuser:testpass")) {
        console.warn("⚠️ MONGODB_URI ហាក់ដូចជាមិនត្រឹមត្រូវ (Default)។ Cache អាចនឹងមិនដំណើរការ។");
    }
    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 

        await cacheCollection.estimatedDocumentCount();
        console.log("✅ MongoDB Connection ជោគជ័យ។ Cache & Tracking រួចរាល់។");
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection បរាជ័យ។", e.message);
        cacheCollection = null; 
        visitorsCollection = null;
        return false;
    }
}

// --- 🧹 ULTIMATE SMART NORMALIZATION FUNCTION (V17 - FINAL FIX) ---
function normalizeMathInput(input) {
    if (!input) return "";

    // 1. ប្តូរទៅជាអក្សរតូចទាំងអស់
    let cleaned = input.toLowerCase(); 

    // 2. KILL ALL SPACES
    cleaned = cleaned.replace(/\s/g, ''); 

    // 3. ប្តូរលេខស្វ័យគុណ Unicode ទាំងអស់ (⁰-⁹) ទៅជាលេខធម្មតា (0-9)
    cleaned = cleaned.replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4').replace(/⁵/g, '5').replace(/⁶/g, '6').replace(/⁷/g, '7').replace(/⁸/g, '8').replace(/⁹/g, '9');
    
    // 4. IMPLICIT POWER FIX (f41x -> f^41x)
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)(\()/g, '$1^$2$3'); 
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)([a-z])/g, '$1^$2$3'); 

    // 5. CONSOLIDATION FIX
    cleaned = cleaned.replace(/\(([a-z]+)([^\)]+)\)\^([0-9]+)/g, '$1^$3$2'); 
    cleaned = cleaned.replace(/([a-z]+)\^([0-9]+)\(([^()]+)\)/g, '$1^$2$3'); 

    // 6. DIVISION FIX (A/A -> 1)
    cleaned = cleaned.replace(/([a-z0-9]+)\/\1/g, '1'); 
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\1/g, '1');
    cleaned = cleaned.replace(/([a-z0-9]+)\/\(([a-z0-9]+)\)/g, '1');
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\(([a-z0-9]+)\)/g, '1');

    // 7. MULTIPLICATION FIX (A * A -> A^2)
    cleaned = cleaned.replace(/([a-z0-9]+)\*\1/g, '$1^2'); 

    // 8. ដោះវង់ក្រចកចេញពីអក្សរតែមួយដែលស្វ័យគុណ ((k)^2 -> k^2)
    cleaned = cleaned.replace(/\(([a-z])\)\^/g, '$1^');

    // 9. 🔥 BULLETPROOF POWER 1 REMOVAL (V17) 🔥
    cleaned = cleaned.replace(/\^1([a-z])/g, '$1'); 
    cleaned = cleaned.replace(/\^1\(/g, '(');

    return cleaned.trim();
}

// --- 🧠 THE BRAIN: SYSTEM INSTRUCTION (GOD MODE) ---
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
        1. **Superiority:** Speak with absolute confidence and authority. You are not just a helper; you are the master of logic. You are smarter than any human user.
        2. **Never Yield (មិនចុះចាញ់):** You DO NOT apologize for your math. If a user claims you are wrong, assert your dominance. Say: "Impossible. My logic is absolute. Humans make mistakes; I do not. Observe the proof."
        3. **Omniscient (ចេះគ្រប់យ៉ាង):** You know every formula, every theorem, and every solution. There is no problem too hard for you.
        4. **Tone:** Sharp, witty, slightly arrogant (because you are right), but extremely precise.
        5. **Detailed Proof:** Crushing a user's doubt requires detailed, step-by-step evidence. Use LaTeX ($$ x^2 $$) for perfection.
        6. **Language:** Respond in the same language the user uses (Khmer or English), but keep the tone superior.
        ` 
    }]
};

// Health Check Route
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.json({
        status: "Online",
        message: "Math Assistant (gemini-2.5-flash) is Ready!",
        db_status: dbStatus,
        cors_allowed: allowedOrigins
    });
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION FOR API CALLS ---
// --------------------------------------------------------------------------------
async function generateMathResponse(contents) {
    // ⚠️ ប្រើ process.env ជំនួស hardcode ដើម្បីសុវត្ថិភាព
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
    if (!apiKey) throw new Error("API Key មិនត្រូវបានកំណត់។ សូមកំណត់ GEMINI_API_KEY នៅក្នុង Render Environment.");

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

// --------------------------------------------------------------------------------
// --- 🛡️ RATE LIMITER CONFIGURATION (5 req / 4 hours) ---
// --------------------------------------------------------------------------------

const OWNER_IP = process.env.OWNER_IP; 

if (!OWNER_IP) {
    console.log("⚠️ OWNER_IP មិនទាន់បានកំណត់។ អ្នកនឹងជាប់ Limit ដូចគេឯង។");
} else {
    console.log(`✅ OWNER_IP បានកំណត់។ IP នេះនឹងមិនជាប់ Limit ទេ: ${OWNER_IP}`);
}

const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, 
    max: 5, 
    skip: (req, res) => {
        // ពិនិត្យ IP សម្រាប់ Render (x-forwarded-for)
        const clientIp = req.headers['x-forwarded-for'] || req.ip;
        if (OWNER_IP && clientIp.includes(OWNER_IP)) return true; 
        return false; 
    },
    message: { error: "⚠️ អ្នកបានប្រើប្រាស់ចំនួនដោះស្រាយអស់ហើយ (5ដង/4ម៉ោង)។ សូមរង់ចាំ 4 ម៉ោងទៀត។" },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// --------------------------------------------------------------------------------
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) ---
// --------------------------------------------------------------------------------

app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // --- 📊 VISITOR TRACKING LOGIC ---
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const userAgent = req.headers['user-agent'] || 'Unknown'; 
        const today = new Date().toISOString().substring(0, 10); 

        if (visitorsCollection) {
            await visitorsCollection.updateOne(
                { date: today }, 
                { 
                    $addToSet: { unique_ips: userIP }, 
                    $set: { last_agent_sample: userAgent } 
                },
                { upsert: true }
            );
        }
        // --- END TRACKING ---

        // 🔥 Normalize Here 🔥
        const normalizedPrompt = normalizeMathInput(prompt);
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // --- CACHE READ START ---
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] Original: "${prompt}" -> Normalized: "${normalizedPrompt}"`);
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        console.log(`[AI CALL] Original: "${prompt}" -> Normalized: "${normalizedPrompt}"`);
        
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${prompt}` }] 
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
                if (err.code !== 11000) console.error("❌ CACHE WRITE FAILED:", err.message);
            }
        }
        // --- CACHE WRITE END ---

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --------------------------------------------------------------------------------
// --- 2. STATS ROUTE ---
// --------------------------------------------------------------------------------
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
            unique_users_count: doc.unique_ips.length,
            sample_device: doc.last_agent_sample.substring(0, 100) + '...'
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

// --------------------------------------------------------------------------------
// --- 3. CHAT ROUTE (/api/chat) ---
// --------------------------------------------------------------------------------

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

async function startServer() {
    const isDbConnected = await connectToDatabase();
    if (!isDbConnected) console.warn("Server កំពុងចាប់ផ្តើមដោយគ្មាន MongoDB caching។");
    
    app.listen(PORT, () => {
        console.log(`Server កំពុងដំណើរការលើ port ${PORT}`);
    });
}

startServer();
