// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V25 - FULL RESTORED & FIXED)
// ==================================================================================
// Developed by: Mr. CHHEANG SINHSINH (BacII 2023 Grade A)
// Powered by: Google Gemini 2.5 Flash & MongoDB Atlas
// ==================================================================================
// 📝 NOTE: This version restores ALL original logic, comments, and structure.
// 🛠️ FIXES: 
//    1. CORS for Cloudflare
//    2. MongoDB Hardcoded URI
//    3. Anti-Collision (No Server Error on spam)
//    4. Power Fix (sin^12x works correctly now)
// ==================================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT RATE LIMIT TO PREVENT ABUSE
// នេះគឺជាការការពារកុំឱ្យគេ Spam Server របស់អ្នក
const rateLimit = require('express-rate-limit'); 

// 2. IMPORT MONGODB DRIVER 
// ប្រើសម្រាប់ភ្ជាប់ទៅ Database ដើម្បីរក្សាទុក Cache
const { MongoClient } = require('mongodb');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

// ==================================================================================
// 🚨 IMPORTANT FOR RENDER/CLOUD DEPLOYMENT 🚨
// ==================================================================================
// ដោយសារ Render ប្រើ Proxy, យើងត្រូវប្រាប់ Express ឱ្យទុកចិត្ត Proxy នោះ
// បើមិនចឹងទេ Rate Limiter នឹងមិនស្គាល់ IP ពិតរបស់អ្នកប្រើប្រាស់ទេ
app.set('trust proxy', 1);

// ==================================================================================
// 🔥 CORS CONFIGURATION (CLOUDFLARE FIX)
// ==================================================================================
// កន្លែងនេះកំណត់ថាអ្នកណាខ្លះមានសិទ្ធិហៅ API របស់អ្នក
const allowedOrigins = [
    'https://integralcalculator.site',       // ✅ Cloudflare Frontend
    'https://www.integralcalculator.site',   // ✅ Cloudflare Frontend (WWW)
    'https://sinh-1.onrender.com',           // ✅ Backend Itself
    'http://localhost:3000',                 // Local Testing
    'http://127.0.0.1:5500'                  // Live Server VS Code
];

app.use(cors({
    origin: function (origin, callback) {
        // អនុញ្ញាត Request ដែលគ្មាន Origin (Mobile Apps, Curl, Postman)
        if (!origin) return callback(null, true);
        
        // ដើម្បីកុំឱ្យមាន Error CORS យើង Allow ទាំងអស់បណ្តោះអាសន្ន
        // ដើម្បីធានាថា Cloudflare អាចហៅមកបាន១០០%
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// --- Configuration ---
// កំណត់ម៉ូដែល AI ដែលត្រូវប្រើ (Gemini 2.5 Flash លឿននិងឆ្លាត)
const MODEL_NAME = 'gemini-2.5-flash';

// ==================================================================================
// ⚠️⚠️⚠️ MONGODB CONNECTION SETUP (HARDCODED AS REQUESTED) ⚠️⚠️⚠️
// ==================================================================================
// នេះគឺជា Link សម្រាប់ភ្ជាប់ទៅ Database របស់អ្នក។
// សូមកុំកែប្រែវា ប្រសិនបើអ្នកមិនចង់អោយ Database ដាច់។
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 

const client = new MongoClient(uri);

// Variables សម្រាប់រក្សាទុក Connection
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
        // ព្យាយាមភ្ជាប់ទៅ Server
        await client.connect(); 
        
        // ជ្រើសរើស Database ឈ្មោះ "GeminiMathCache"
        const database = client.db("GeminiMathCache"); 
        
        // ជ្រើសរើស Collections (តារាងទិន្នន័យ)
        cacheCollection = database.collection("solutions"); 
        visitorsCollection = database.collection("daily_visitors"); 

        // Test connection ដោយរាប់ចំនួនឯកសារ
        const count = await cacheCollection.estimatedDocumentCount();
        
        console.log("✅ MongoDB Connection ជោគជ័យ (Hardcoded URI)!");
        console.log(`📦 Cache ត្រៀមរួចរាល់។ ចំនួន Cache បច្ចុប្បន្ន: ${count}`);
        
        return true;
    } catch (e) {
        // បើមានបញ្ហា បង្ហាញ Error ក្នុង Console
        console.error("❌ MONGODB FATAL Connection បរាជ័យ:", e.message);
        cacheCollection = null; 
        visitorsCollection = null;
        return false;
    }
}

// ==================================================================================
// 🧹 ULTIMATE SMART NORMALIZATION FUNCTION (SAFE VERSION)
// ==================================================================================
// មុខងារនេះមានតួនាទីសំអាតលំហាត់គណិតវិទ្យាអោយមានស្តង់ដារតែមួយ។
// ⚠️ UPDATED: កែសម្រួលដើម្បីកុំអោយខូចលេខស្វ័យគុណច្រើនខ្ទង់ (sin^12 x)
function normalizeMathInput(input) {
    if (!input) return "";

    // 1. ប្តូរទៅជាអក្សរតូចទាំងអស់ (sin, SIN, Sin -> sin)
    let cleaned = input.toLowerCase(); 

    // 2. KILL ALL SPACES (លុបចន្លោះទាំងអស់ចេញ)
    cleaned = cleaned.replace(/\s/g, ''); 

    // 3. ប្តូរលេខស្វ័យគុណ Unicode ទាំងអស់ (⁰-⁹) ទៅជាលេខធម្មតា (0-9)
    cleaned = cleaned.replace(/⁰/g, '0');
    cleaned = cleaned.replace(/¹/g, '1');
    cleaned = cleaned.replace(/²/g, '2');
    cleaned = cleaned.replace(/³/g, '3');
    cleaned = cleaned.replace(/⁴/g, '4');
    cleaned = cleaned.replace(/⁵/g, '5');
    cleaned = cleaned.replace(/⁶/g, '6');
    cleaned = cleaned.replace(/⁷/g, '7');
    cleaned = cleaned.replace(/⁸/g, '8');
    cleaned = cleaned.replace(/⁹/g, '9');
    
    // 4. IMPLICIT POWER FIX (Safe Logic)
    // ប្រើ Greedy capture ([0-9]+) ដើម្បីធានាថាចាប់បានលេខទាំងអស់ (41, 14, 11)
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)(\()/g, '$1^$2$3'); // sin12(x) -> sin^12(x)
    cleaned = cleaned.replace(/([a-z]+)([0-9]+)([a-z])/g, '$1^$2$3'); // sin12x -> sin^12x

    // 5. CONSOLIDATION FIX
    // ប្តូរពីទម្រង់ (sinx)^n ទៅជា sin^n x អោយដូចគ្នា
    cleaned = cleaned.replace(/\(([a-z]+)([^\)]+)\)\^([0-9]+)/g, '$1^$3$2'); // (sinx)^12 -> sin^12 x
    cleaned = cleaned.replace(/([a-z]+)\^([0-9]+)\(([^()]+)\)/g, '$1^$2$3'); // sin^12(x) -> sin^12 x

    // 6. DIVISION FIX (A/A -> 1)
    // បើចែកចំនួនដូចគ្នា គឺស្មើ 1
    cleaned = cleaned.replace(/([a-z0-9]+)\/\1/g, '1'); 
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\1/g, '1');
    cleaned = cleaned.replace(/([a-z0-9]+)\/\(([a-z0-9]+)\)/g, '1');
    cleaned = cleaned.replace(/\(([a-z0-9]+)\)\/\(([a-z0-9]+)\)/g, '1');

    // 7. MULTIPLICATION FIX (A * A -> A^2)
    // បើគុណចំនួនដូចគ្នា គឺស្មើការេ
    cleaned = cleaned.replace(/([a-z0-9]+)\*\1/g, '$1^2'); 

    // 8. ដោះវង់ក្រចកចេញពីអក្សរតែមួយដែលស្វ័យគុណ ((k)^2 -> k^2)
    cleaned = cleaned.replace(/\(([a-z])\)\^/g, '$1^');

    // 9. 🔥 POWER 1 REMOVAL (SAFE MODE) 🔥
    // ⚠️ កែសម្រួល៖ លុបតែ ^1 ដែលនៅខាងមុខអក្សរ ប៉ុន្តែកុំប៉ះពាល់លេខផ្សេង (ដូចជា ^12)
    // Regex នេះធានាថាវាមិនប៉ះពាល់ sin^12x ទេ
    cleaned = cleaned.replace(/\^1(?![0-9])([a-z])/g, '$1'); 
    cleaned = cleaned.replace(/\^1(?![0-9])\(/g, '(');

    return cleaned.trim();
}

// ==================================================================================
// 🧠 THE BRAIN: SYSTEM INSTRUCTION (GOD MODE)
// ==================================================================================
// នេះគឺជាការណែនាំដ៏សំខាន់សម្រាប់ AI ដើម្បីអោយវាឆ្លើយត្រូវតាមអត្តចរិតដែលអ្នកចង់បាន
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
    // ⚠️ ប្រើ API Key ពី Env
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
    
    if (!apiKey) {
        throw new Error("API Key មិនត្រូវបានកំណត់។ សូមកំណត់ GEMINI_API_KEY នៅក្នុង Render Environment.");
    }

    // ហៅទៅ Google Gemini API
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
    
    // ទាញយកអត្ថបទចេញពីចម្លើយរបស់ AI
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ==================================================================================
// 🛡️ RATE LIMITER CONFIGURATION (5 req / 4 hours)
// ==================================================================================
// កំណត់ IP ម្ចាស់ដើម្បីកុំអោយជាប់ Limit
const OWNER_IP = process.env.OWNER_IP; 

if (!OWNER_IP) {
    console.log("⚠️ OWNER_IP មិនទាន់បានកំណត់។ អ្នកនឹងជាប់ Limit ដូចគេឯង។");
} else {
    console.log(`✅ OWNER_IP បានកំណត់។ IP នេះនឹងមិនជាប់ Limit ទេ: ${OWNER_IP}`);
}

const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, // រយៈពេល 4 ម៉ោង
    max: 5, // អនុញ្ញាតអោយចុចបានតែ 5 ដង
    skip: (req, res) => {
        // ប្រើ x-forwarded-for សម្រាប់ Render IP check
        const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip;
        
        // បើ IP ត្រូវគ្នាជាមួយម្ចាស់ គឺអោយឆ្លងកាត់ (Skip Limit)
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
// នេះគឺជាកន្លែងដែលការគណនាកើតឡើង
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // --- 📊 VISITOR TRACKING LOGIC ---
        // កត់ត្រាចំនួនអ្នកចូលប្រើប្រាស់ប្រចាំថ្ងៃ
        const userIP = req.headers['x-forwarded-for'] || req.ip; 
        const userAgent = req.headers['user-agent'] || 'Unknown'; 
        const today = new Date().toISOString().substring(0, 10); 

        if (visitorsCollection) {
            // Tracking (No Await ដើម្បីលឿន)
            visitorsCollection.updateOne(
                { date: today }, 
                { 
                    $addToSet: { unique_ips: userIP }, 
                    $set: { last_agent_sample: userAgent } 
                },
                { upsert: true }
            ).catch(err => console.error("Tracking Error:", err.message));
        }
        // --- END TRACKING ---

        // 🔥 NORMALIZE INPUT 🔥
        // ធ្វើអោយលំហាត់មានទម្រង់ស្តង់ដារ
        const normalizedPrompt = normalizeMathInput(prompt);
        // បង្កើត Key សម្រាប់ Cache
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // --- CACHE READ START ---
        // ពិនិត្យមើលថាតើលំហាត់នេះមានក្នុង Database ហើយឬនៅ?
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] Original: "${prompt}" -> Normalized: "${normalizedPrompt}"`);
                    // បើមាន យកចម្លើយចាស់មកប្រើភ្លាមៗ
                    return res.json({ text: cachedResult.result_text, source: "cache" });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        // បើគ្មានក្នុង Cache ទេ ហៅទៅ AI
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

        // --- 🔥 CACHE WRITE START (ANTI-COLLISION FIX) 🔥 ---
        // រក្សាទុកចម្លើយថ្មីទៅក្នុង Database
        if (cacheCollection) {
            try {
                await cacheCollection.insertOne({
                    _id: cacheKey,
                    result_text: resultText,
                    timestamp: new Date()
                });
                console.log(`[CACHE WRITE SUCCESS]`);
            } catch (err) {
                // 🛑 ការពារ SERVER ERROR ពេលចុចលឿនពេក 🛑
                // ប្រសិនបើ Error Code 11000 (Duplicate Key) យើងមិនអើពើទេ
                // ព្រោះមានន័យថា Request ផ្សេងទៀតបាន Save រួចហើយ
                if (err.code === 11000) {
                    console.warn(`[CACHE WRITE IGNORED] Key already exists (Collision avoided).`);
                } else {
                    console.error("❌ CACHE WRITE FAILED:", err.message);
                }
            }
        }
        // --- CACHE WRITE END ---

        // ផ្ញើចម្លើយទៅ Frontend
        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 2. STATS ROUTE (/api/daily-stats)
// ==================================================================================
// មើលស្ថិតិអ្នកប្រើប្រាស់
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
// សម្រាប់មុខងារ Chatbot
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
    console.log("🚀 STARTING INTEGRAL CALCULATOR BACKEND (V25)...");
    console.log("----------------------------------------------------------------");

    // ភ្ជាប់ទៅ Database មុននឹងបើក Server
    const isDbConnected = await connectToDatabase();
    
    if (!isDbConnected) {
        console.warn("⚠️ Server កំពុងចាប់ផ្តើមដោយគ្មាន MongoDB caching (ឬ Connection Failed)។");
    }
    
    app.listen(PORT, () => {
        console.log(`\n🌐 Server កំពុងដំណើរការលើ port ${PORT}`);
        console.log("----------------------------------------------------------------");
    });
}

// ចាប់ផ្តើមកម្មវិធី
startServer();
