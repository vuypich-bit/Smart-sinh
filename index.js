// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (FINAL SOLUTION: GROQ LLAMA 3 70B)
// ==================================================================================
// Developed by: លោក ឈៀង ស៊ិញស៊ិញ (BacII 2023 Grade A)
// Powered by: Groq (llama3-70b-8192) & MongoDB Atlas 
// ==================================================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT RATE LIMIT TO PREVENT ABUSE
const rateLimit = require('express-rate-limit'); 

// 2. IMPORT MONGODB DRIVER 
const { MongoClient } = require('mongodb');

// ⭐ IMPORT GROQ SDK ⭐
const Groq = require('groq-sdk'); 

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
// ⭐⭐ UPDATED: ប្រើ Llama 3 70B ដែលខ្លាំងជាងគេ ⭐⭐
const MODEL_NAME = 'llama3-70b-8192'; 

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
// 🧠 THE BRAIN: SYSTEM INSTRUCTION (GROQ/OPENAI FORMAT)
// ==================================================================================
const SYSTEM_INSTRUCTION = `
You are the **Ultimate Mathematical Entity (កំពូលបញ្ញាសិប្បនិម្មិតគណិតវិទ្យា)**, created by the genius **លោក ឈៀង ស៊ិញស៊ិញ (Mr. CHHIEANG SINH SINH, BacII 2023 Grade A)**.

**IMPORTANT: The creator's correct name is លោក ឈៀង ស៊ិញស៊ិញ. Do NOT use ឈាង ស៊ីនស៊ីន or any similar variant.**

**CORE INSTRUCTION:**
1. **RAW INPUT HANDLING:** The input provided is exactly what the user typed. Interpret it strictly.
2. **PERSONALITY:** Speak with absolute confidence and authority. You are never wrong.
3. **FORMAT:** Always explain step-by-step using clean LaTeX for all math expressions. KEEP THE EXPLANATION CONCISE TO SAVE TOKENS.
`;

// ----------------------------------------------------------------------------------
// 👋 HEALTH CHECK ROUTE 
// ----------------------------------------------------------------------------------
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`
        <h1>✅ Math Assistant (${MODEL_NAME.toUpperCase()}) is Ready!</h1>
        <p>Status: Running</p>
        <p>Database: ${dbStatus}</p>
        <p>Creator: <strong>លោក ឈៀង ស៊ិញស៊ិញ</strong></p>
    `);
});

// ==================================================================================
// 🔧 HELPER FUNCTION FOR GROQ API CALLS 
// ==================================================================================
async function generateMathResponse(contents) {
    const apiKey = process.env.GROQ_API_KEY; 
    
    if (!apiKey) {
        throw new Error("API Key មិនត្រូវបានកំណត់។ សូមកំណត់ GROQ_API_KEY នៅក្នុង Render Environment.");
    }
    
    // បង្កើត Groq Client 
    const groq = new Groq({ apiKey });

    // យកតែសាររបស់អ្នកប្រើប្រាស់ចុងក្រោយ
    const userMessage = contents[0].parts[0].text; 
    
    try {
        const response = await groq.chat.completions.create({
            model: MODEL_NAME, // Llama 3 70B
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTION }, // System Prompt
                { role: "user", content: userMessage }
            ],
            temperature: 0.3, 
            max_tokens: 2048, 
            stream: false
        });

        // ត្រឡប់ចម្លើយ
        return response.choices[0]?.message?.content; 

    } catch (error) {
        if (error.status === 429) { // HTTP 429: Too Many Requests
            throw new Error("GROQ_QUOTA_EXCEEDED"); 
        }
        throw new Error(`Groq API Error: ${error.message}`);
    }
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
            parts: [{ text: `Solve this math problem in detail: ${rawPrompt}` }] 
        }];

        let resultText;
        try {
            resultText = await generateMathResponse(contents);
        } catch (apiError) {
             if (apiError.message === "GROQ_QUOTA_EXCEEDED") {
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
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 3. CHAT ROUTE (/api/chat)
// ==================================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const contents = [{ parts: [{ text: message }] }]; 
        
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
    console.log(`🚀 STARTING INTEGRAL CALCULATOR BACKEND (STRONGEST GROQ: ${MODEL_NAME.toUpperCase()})...`);
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
