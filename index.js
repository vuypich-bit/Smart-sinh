// index.js (Version: God-Mode Math Assistant + Owner Bypass + Rate Limit)

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

app.use(cors());
app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// --- 🧠 MONGODB CONNECTION SETUP ---
const uri = "mongodb+srv://testuser:testpass@cluster0.chyfb9f.mongodb.net/?appName=Cluster0"; 

const client = new MongoClient(uri);

let cacheCollection; 

// ភ្ជាប់ទៅ Database
async function connectToDatabase() {
    if (!uri) {
        console.warn("⚠️ MONGODB_URI មិនត្រូវបានកំណត់។ Cache ត្រូវបានបិទ។");
        return false;
    }
    try {
        await client.connect(); 
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        await cacheCollection.estimatedDocumentCount();
        console.log("✅ MongoDB Connection ជោគជ័យ។ Cache រួចរាល់។");
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection បរាជ័យ។", e.message);
        cacheCollection = null; 
        return false;
    }
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
    res.send(`✅ Math Assistant (gemini-2.5-flash) is Ready! DB Cache Status: ${dbStatus}`);
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION FOR API CALLS ---
// --------------------------------------------------------------------------------
async function generateMathResponse(contents) {
    const apiKey = process.env.GEMINI_API_KEY; 
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
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(`Gemini API Error (${response.status}): ${errorData.error ? errorData.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// --------------------------------------------------------------------------------
// --- 🛡️ RATE LIMITER CONFIGURATION (5 req / 4 hours) ---
// --------------------------------------------------------------------------------

// ទទួលយក IP ពី Environment Variable (Render)
const OWNER_IP = process.env.OWNER_IP; 

if (!OWNER_IP) {
    console.log("⚠️ OWNER_IP មិនទាន់បានកំណត់។ អ្នកនឹងជាប់ Limit ដូចគេឯង។");
} else {
    console.log(`✅ OWNER_IP បានកំណត់។ IP នេះនឹងមិនជាប់ Limit ទេ: ${OWNER_IP}`);
}

const solverLimiter = rateLimit({
    windowMs: 4 * 60 * 60 * 1000, // 4 ម៉ោង
    max: 5, // 5 ដងសម្រាប់មនុស្សទូទៅ
    
    // --- មុខងារពិសេសសម្រាប់ម្ចាស់ (SKIP) ---
    skip: (req, res) => {
        if (OWNER_IP && req.ip === OWNER_IP) {
            console.log(`[VIP ACCESS] Skipping Rate Limit for Owner: ${req.ip}`);
            return true; 
        }
        return false; 
    },

    message: { 
        error: "⚠️ អ្នកបានប្រើប្រាស់ចំនួនដោះស្រាយអស់ហើយ (5ដង/4ម៉ោង)។ សូមរង់ចាំ 4 ម៉ោងទៀត។" 
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// --------------------------------------------------------------------------------
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) WITH CACHE & LIMITER ---
// --------------------------------------------------------------------------------

app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        const { prompt } = req.body; 
        
        // Normalization
        const normalizedPrompt = prompt.toLowerCase().trim().replace(/\s+/g, ' ');
        const cacheKey = Buffer.from(normalizedPrompt).toString('base64');
        
        // --- CACHE READ START ---
        if (cacheCollection) {
            try {
                const cachedResult = await cacheCollection.findOne({ _id: cacheKey });
                if (cachedResult) {
                    console.log(`[CACHE HIT] រកឃើញលទ្ធផលសម្រាប់: "${normalizedPrompt.substring(0, 20)}..."`);
                    return res.json({ text: cachedResult.result_text });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        console.log(`[AI CALL] កំពុងហៅ Gemini សម្រាប់: "${normalizedPrompt.substring(0, 20)}..."`);
        
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${prompt}` }] 
        }];

        // ហៅ AI
        const resultText = await generateMathResponse(contents);

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
                if (err.code !== 11000) { 
                    console.error("❌ CACHE WRITE FAILED (មិនធ្ងន់ធ្ងរ):", err.message);
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
// --- 2. CHAT ROUTE (/api/chat) ---
// --------------------------------------------------------------------------------

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        const contents = [
            ...(history || []), 
            { role: 'user', parts: [{ text: message }] }
        ];

        const resultText = await generateMathResponse(contents);

        if (!resultText) return res.status(500).json({ error: "AI មិនបានផ្តល់ខ្លឹមសារទេ។" });
        res.json({ text: resultText });
        
    } catch (error) {
        console.error("CHAT ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});


// --------------------------------------------------------------------------------
// --- STARTUP FUNCTION ---
// --------------------------------------------------------------------------------

async function startServer() {
    const isDbConnected = await connectToDatabase();
    
    if (!isDbConnected) {
        console.warn("Server កំពុងចាប់ផ្តើមដោយគ្មាន MongoDB caching។");
    }
    
    app.listen(PORT, () => {
        console.log(`Server កំពុងដំណើរការលើ port ${PORT} ដោយប្រើ model ${MODEL_NAME}`);
        console.log(`Access the App at: https://smart-sinh-i.onrender.com`);
    });
}

startServer();
