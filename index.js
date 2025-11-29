// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V24 - PURE INPUT FIX)
// ==================================================================================
// Developed by: Mr. CHHEANG SINHSINH (BacII 2023 Grade A)
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

// ==================================================================================
// 🚨 IMPORTANT FOR RENDER/CLOUD DEPLOYMENT 🚨
// ==================================================================================
app.set('trust proxy', 1);

// ==================================================================================
// 🔥 CORS CONFIGURATION (CLOUDFLARE FIX)
// ==================================================================================
const allowedOrigins = [
    'https://integralcalculator.site',       
    'https://www.integralcalculator.site',   
    'https://sinh-1.onrender.com',           
    'http://localhost:3000',                 
    'http://127.0.0.1:5500'                  
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

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// ==================================================================================
// ⚠️⚠️⚠️ MONGODB CONNECTION SETUP ⚠️⚠️⚠️
// ==================================================================================
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 

const client = new MongoClient(uri);

let cacheCollection; 
let visitorsCollection; 

// ----------------------------------------------------------------------------------
// 🔗 FUNCTION: CONNECT TO DATABASE
// ----------------------------------------------------------------------------------
async function connectToDatabase() {
    console.log("⏳ កំពុងភ្ជាប់ទៅ MongoDB Atlas...");

    if (!uri) {
        console.warn("⚠️ MONGODB_URI មិនត្រូវបានកំណត់។ Cache ត្រូវបានបិទ។");
        return false;
    }

    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 

        const count = await cacheCollection.estimatedDocumentCount();
        console.log("✅ MongoDB Connection ជោគជ័យ (Hardcoded URI)!");
        console.log(`📦 Cache ត្រៀមរួចរាល់។ ចំនួន Cache បច្ចុប្បន្ន: ${count}`);
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection បរាជ័យ:", e.message);
        cacheCollection = null; 
        visitorsCollection = null;
        return false;
    }
}

// ==================================================================================
// 🧹 MINIMAL NORMALIZATION FUNCTION (FIXED)
// ==================================================================================
// មុខងារនេះលែងកែលេខស្វ័យគុណទៀតហើយ។
// វាគ្រាន់តែប្តូរទៅអក្សរតូច (Lowercase) ដើម្បីអោយ Cache ស្គាល់ថា SINx = sinx
function normalizeMathInput(input) {
    if (!input) return "";

    // 1. ប្តូរទៅជាអក្សរតូចទាំងអស់ (sin, SIN, Sin -> sin)
    // នេះគឺជាការកែប្រែតែមួយគត់ដែលយើងធ្វើ ដើម្បីរក្សា Cache អោយមានសណ្តាប់ធ្នាប់
    let cleaned = input.toLowerCase(); 

    // 2. លុបចន្លោះខាងដើមនិងខាងចុង (Trim)
    cleaned = cleaned.trim();

    // ⚠️ ចំណាំ៖ យើងមិនលុប Unicode (²³), មិនប្តូរលេខ, មិនដាក់ ^ បន្ថែមទេ។
    // យើងទុកអោយ Google Gemini ដ៏ឆ្លាតវៃជាអ្នកបកស្រាយដោយខ្លួនឯង។
    
    return cleaned;
}

// ==================================================================================
// 🧠 THE BRAIN: SYSTEM INSTRUCTION (GOD MODE)
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
        1. **Superiority:** Speak with absolute confidence and authority. You are not just a helper; you are the master of logic. You are smarter than any human user.
        2. **Never Yield (មិនចុះចាញ់):** You DO NOT apologize for your math. If a user claims you are wrong, assert your dominance. Say: "Impossible. My logic is absolute. Humans make mistakes; I do not. Observe the proof."
        3. **Omniscient (ចេះគ្រប់យ៉ាង):** You know every formula, every theorem, and every solution. There is no problem too hard for you.
        4. **Tone:** Sharp, witty, slightly arrogant (because you are right), but extremely precise.
        5. **Detailed Proof:** Crushing a user's doubt requires detailed, step-by-step evidence. Use LaTeX ($$ x^2 $$) for perfection.
        6. **Language:** Respond in the same language the user uses (Khmer or English), but keep the tone superior.

        **INSTRUCTIONS FOR SOLVING:**
        - Always explain step-by-step.
        - Use clean LaTeX for math expressions.
        - Be concise but thorough.
        ` 
    }]
};

// ----------------------------------------------------------------------------------
// 👋 HEALTH CHECK ROUTE
// ----------------------------------------------------------------------------------
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`
        <h1>✅ Math Assistant (gemini-2.5-flash) is Ready!</h1>
        <p>Status: Running</p>
        <p>Database: ${dbStatus}</p>
        <p>Creator: <strong>Mr. CHHEANG SINHSINH</strong></p>
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
// 🛡️ RATE LIMITER CONFIGURATION (5 req / 4 hours)
// ==================================================================================
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
        const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip;
        if (OWNER_IP && clientIp.includes(OWNER_IP)) return true; 
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
        const { prompt } = req.body; 
        
        // --- 📊 VISITOR TRACKING LOGIC ---
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const userAgent = req.headers['user-agent'] || 'Unknown'; 
        const today = new Date().toISOString().substring(0, 10); 

        if (visitorsCollection) {
            visitorsCollection.updateOne(
                { date: today }, 
                { 
                    $addToSet: { unique_ips: userIP }, 
                    $set: { last_agent_sample: userAgent } 
                },
                { upsert: true }
            ).catch(err => console.error("Tracking Error:", err.message));
        }

        // 🔥 SIMPLE NORMALIZATION (ONLY LOWERCASE) 🔥
        // យើងគ្រាន់តែប្តូរទៅអក្សរតូចដើម្បីងាយស្រួល Cache (A = a)
        // ឧទាហរណ៍៖ "X²¹" នឹងក្លាយជា "x²¹" (រក្សាស្វ័យគុណដដែល)
        const normalizedPrompt = normalizeMathInput(prompt);
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // --- CACHE READ ---
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] Original: "${prompt}" -> Using Cache Key: "${normalizedPrompt}"`);
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        
        // --- CALL AI ---
        console.log(`[AI CALL] Sending Raw (Lowercased) to Gemini: "${normalizedPrompt}"`);
        
        // យើងផ្ញើ normalizedPrompt (អក្សរតូច) ទៅ AI
        // Gemini ឆ្លាតណាស់ វាស្គាល់ x²¹ និង x^21 ច្បាស់ណាស់។
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${normalizedPrompt}` }] 
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

        // --- CACHE WRITE ---
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
                    console.warn(`[CACHE WRITE IGNORED] Duplicate Key.`);
                } else {
                    console.error("❌ CACHE WRITE FAILED:", err.message);
                }
            }
        }

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
    console.log("🚀 STARTING INTEGRAL CALCULATOR BACKEND (V24)...");
    console.log("----------------------------------------------------------------");

    const isDbConnected = await connectToDatabase();
    
    if (!isDbConnected) {
        console.warn("⚠️ Server កំពុងចាប់ផ្តើមដោយគ្មាន MongoDB caching (ឬ Connection Failed)។");
    }
    
    app.listen(PORT, () => {
        console.log(`\n🌐 Server កំពុងដំណើរការលើ port ${PORT}`);
        console.log(`👉 Link: http://localhost:${PORT}`);
        console.log("----------------------------------------------------------------");
    });
}

startServer();
