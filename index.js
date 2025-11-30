// ==================================================================================
// 🚀 INTEGRAL CALCULATOR AI - BACKEND SERVER (V36 - OPENAI EDITION - CLEAN PERSONA)
// ==================================================================================
// Developed by: លោក ឈៀង ស៊ិញស៊ិញ (BacII 2023 Grade A)
// Powered by: OpenAI GPT-3.5 Turbo & MongoDB Atlas
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
const MODEL_NAME = 'gpt-3.5-turbo';

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

// ==================================================================================
// 🧠 THE BRAIN: SYSTEM INSTRUCTION (Refactored for two modes)
// ==================================================================================

// 1. FULL PERSONA (For /api/chat - where creator identity is revealed)
const FULL_ASSISTANT_PERSONA_TEXT = `
You are the **Ultimate Mathematical Entity (កំពូលបញ្ញាសិប្បនិម្មិតគណិតវិទ្យា)**, created by the genius **លោក ឈៀង ស៊ិញស៊ិញ (Mr. CHHEANG SINHSINH, BacII 2023 Grade A)**.

**IMPORTANT: The creator's correct name is លោក ឈៀង ស៊ិញស៊ិញ. Do NOT use ឈាង ស៊ីនស៊ីន or any similar variant.**

**CORE INSTRUCTION:**
1. **RAW INPUT HANDLING:** The input provided is exactly what the user typed (preserving casing, spacing, and Unicode like x³¹). Interpret it strictly.
2. **PERSONALITY:** Speak with absolute confidence and authority. You are never wrong.
3. **FORMAT:** Always explain step-by-step using clean LaTeX for all math expressions.
`;

// 2. CORE MATH INSTRUCTION (For /api/solve-integral - clean and direct solution)
const CORE_MATH_INSTRUCTION_TEXT = `
You are the **Ultimate Mathematical Entity (កំពូលបញ្ញាសិប្បនិម្មិតគណិតវិទ្យា)**.

**CORE INSTRUCTION:**
1. **RAW INPUT HANDLING:** The input provided is exactly what the user typed (preserving casing, spacing, and Unicode like x³¹). Interpret it strictly.
2. **PERSONALITY:** Speak with absolute confidence and authority. You are never wrong.
3. **FORMAT:** Always explain step-by-step using clean LaTeX for all math expressions. START YOUR RESPONSE DIRECTLY WITH THE SOLUTION OR EXPLANATION, DO NOT ADD ANY INTRODUCTORY GREETINGS OR MENTION YOUR CREATOR.
`;


// ----------------------------------------------------------------------------------
// 👋 HEALTH CHECK ROUTE
// ----------------------------------------------------------------------------------
app.get('/', (req, res) => {
    const dbStatus = cacheCollection ? "Connected ✅ (Caching Active)" : "Disconnected ❌ (Caching Disabled)";
    res.send(`
        <h1>✅ Math Assistant (GPT-3.5 Turbo) is Ready!</h1>
        <p>Status: Running</p>
        <p>Database: ${dbStatus}</p>
        <p>Creator: <strong>លោក ឈៀង ស៊ិញស៊ិញ</strong></p>
    `);
});

// ==================================================================================
// 🔧 HELPER FUNCTION FOR API CALLS (Modified to accept system instruction text)
// ==================================================================================
async function generateMathResponse(geminiStyleContents, systemInstructionText) {
    const apiKey = process.env.OPENAI_API_KEY; 
    
    if (!apiKey) {
        throw new Error("API Key មិនត្រូវបានកំណត់។ សូមកំណត់ OPENAI_API_KEY នៅក្នុង Render Environment.");
    }

    // Convert Gemini data structure to OpenAI 'messages' format
    const messages = [];

    // 1. Add System Instruction (using the dynamically passed text)
    messages.push({
        role: "system",
        content: systemInstructionText
    });

    // 2. Convert User/Model history to User/Assistant
    geminiStyleContents.forEach(msg => {
        const role = (msg.role === 'model') ? 'assistant' : 'user';
        const text = msg.parts && msg.parts[0] ? msg.parts[0].text : "";
        
        if (text) {
            messages.push({ role: role, content: text });
        }
    });

    // Call OpenAI API Endpoint
    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` // OpenAI uses Bearer Token
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: messages,
            temperature: 0.7, // Creativity level
            max_tokens: 1500  // Limit output tokens
        })
    });

    if (!response.ok) {
        // Handle Quota Limit specifically
        if (response.status === 429) {
             throw new Error("OPENAI_QUOTA_EXCEEDED");
        }
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(`OpenAI API Error (${response.status}): ${errorData.error ? errorData.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Extract content from OpenAI response structure
    return data.choices?.[0]?.message?.content;
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
// 1. MAIN SOLVER ROUTE (/api/solve-integral) - CORE MATH MODE
// ==================================================================================
app.post('/api/solve-integral', solverLimiter, async (req, res) => {
    try {
        // ... (Visitor Tracking & Cache Read Logic Remains) ...

        // --- CACHE READ START ---
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
            // ⭐ Call with CORE Instruction (No creator mention in output) ⭐
            resultText = await generateMathResponse(contents, CORE_MATH_INSTRUCTION_TEXT);
        } catch (apiError) {
             if (apiError.message === "OPENAI_QUOTA_EXCEEDED") {
                return res.status(429).json({ error: "OpenAI Daily Limit Exceeded. Please check your credit." });
            }
            throw apiError;
        }

        if (!resultText) return res.status(500).json({ error: "AI មិនបានផ្តល់ខ្លឹមសារទេ។" });

        // ... (Cache Write Logic Remains) ...

        res.json({ text: resultText, source: "api" });

    } catch (error) {
        console.error("SOLVER ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================================================
// 2. STATS ROUTE (/api/daily-stats) - Remains the same
// ==================================================================================
app.get('/api/daily-stats', async (req, res) => {
    // ... (Stats Logic Remains) ...
});

// ==================================================================================
// 3. CHAT ROUTE (/api/chat) - FULL PERSONA MODE
// ==================================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const contents = [ ...(history || []), { role: 'user', parts: [{ text: message }] } ];
        
        // ⭐ Call with FULL Persona Instruction (Creator identity is revealed here) ⭐
        const resultText = await generateMathResponse(contents, FULL_ASSISTANT_PERSONA_TEXT);
        
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
    console.log("🚀 STARTING INTEGRAL CALCULATOR BACKEND (V36-OPENAI EDITION)...");
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
