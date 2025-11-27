// index.js (កូដចុងក្រោយ: ជំនួយការគណិតវិទ្យាឆ្លាតវៃជាមួយ Rate Limiting)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT RATE LIMITER
const rateLimit = require('express-rate-limit');

// 2. IMPORT MONGODB DRIVER 
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// --- 🛑 គោលការណ៍កំណត់ល្បឿនថ្មី: 5 Requests ក្នុង 30 នាទី ---
const limiter = rateLimit({
	windowMs: 30 * 60 * 1000, // 30 នាទី (1,800,000 ms)
	max: 5, // អនុញ្ញាតអោយមាន 5 Requests ក្នុង 30 នាទី ពី IP តែមួយ
    message: async (req, res) => {
        // 🚨 នេះជាកន្លែងដែលយើងកំណត់សារឆ្លើយតប
        res.status(429).json({ 
            error: "Quota exceeded (5 requests per 30 minutes). Please wait 30 minutes.",
            khmer_message: "សំណើច្រើនពេក។ អ្នកត្រូវបានកំណត់ត្រឹម ៥ ដងក្នុងរយៈពេល ៣០ នាទី។ សូមរង់ចាំ ៣០ នាទីមុននឹងប្រើម្តងទៀត។"
        });
    },
	standardHeaders: true, // ប្រើ Rate Limit Headers
	legacyHeaders: false, // បិទ Legacy Headers
});

// អនុវត្ត Rate Limiter ទៅលើ APIs សំខាន់ៗទាំងអស់ (Solve និង Chat)
app.use("/api/", limiter);


// --- 🧠 MONGODB CONNECTION SETUP ---
// ប្រើ URI ថ្មីពី Cluster ថ្មី (cluster0.chyfb9f)
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
        
        // Database Name សម្រាប់ Cache
        const database = client.db("GeminiMathCache"); 
        cacheCollection = database.collection("solutions"); 
        
        // ពិនិត្យការតភ្ជាប់ដោយរាប់ឯកសារ
        await cacheCollection.estimatedDocumentCount();

        console.log("✅ MongoDB Connection ជោគជ័យ។ Cache រួចរាល់។");
        return true;
    } catch (e) {
        console.error("❌ MONGODB FATAL Connection បរាជ័យ។ សូមពិនិត្យ Network Access (0.0.0.0/0) ក្នុង Atlas", e.message);
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
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`✅ Math Assistant (gemini-2.5-flash) is Ready! DB Cache Status: ${dbStatus}`);
});

// --------------------------------------------------------------------------------
// --- HELPER FUNCTION FOR API CALLS (unchanged) ---
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
// --- 1. MAIN SOLVER ROUTE (/api/solve-integral) WITH CACHE ---
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
                    console.log(`[CACHE HIT] រកឃើញលទ្ធផលសម្រាប់: "${normalizedPrompt.substring(0, 20)}..."`);
                    return res.json({ text: cachedResult.result_text });
                }
            } catch (err) {
                console.error("❌ CACHE READ FAILED:", err.message);
            }
        }
        // --- CACHE READ END ---
        
        console.log(`[AI CALL] កំពុងហៅ Gemini សម្រាប់: "${normalizedPrompt.substring(0, 20)}..."`);
        
        // បន្ថែមឃ្លាដើម្បីឱ្យវាដឹងថាត្រូវដោះស្រាយលំហាត់
        const contents = [{ 
            role: 'user', 
            parts: [{ text: `Solve this math problem in detail: ${prompt}` }] 
        }];

        // 2. ហៅ AI (ប្រសិនបើគ្មានក្នុង Cache)
        const resultText = await generateMathResponse(contents);

        if (!resultText) return res.status(500).json({ error: "AI មិនបានផ្តល់ខ្លឹមសារទេ។" });

        // --- CACHE WRITE START ---
        if (cacheCollection) {
            try {
                // ប្រើ CacheKey ដែលបាន Normalize
                await cacheCollection.insertOne({
                    _id: cacheKey,
                    result_text: resultText,
                    timestamp: new Date()
                });
                console.log(`[CACHE WRITE SUCCESS] រក្សាទុកលទ្ធផលសម្រាប់: "${normalizedPrompt.substring(0, 20)}..."`);
            } catch (err) {
                // ភាគច្រើន Error នេះគឺដោយសារតែ Duplicate Key ឬ DB Connection error
                if (err.code !== 11000) { // 11000 = Duplicate Key Error (ដែលមិនបង្កបញ្ហា)
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
// --- STARTUP FUNCTION (unchanged) ---
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
