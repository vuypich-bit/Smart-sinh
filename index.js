// index.js (កូដចុងក្រោយដែលបានជួសជុលកំហុស "config" ទៅ "generationConfig")

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// ត្រូវប្រាកដថាអ្នកបានដំឡើង (install) dependencies ទាំងនេះក្នុង package.json

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // ប្រើ Port 10000

app.use(cors());
app.use(express.json());

// --- Configuration ---
const MODEL_NAME = 'gemini-2.5-flash';

// Health Check Route
app.get('/', (req, res) => {
    res.send('✅ Server is Running! Ready to solve math.');
});

// --- Main Route to Solve Integral ---
// Route: /api/solve-integral
app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt, systemInstruction } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // --- 🔴 DEBUGGING LINE (ដើម្បីពិនិត្យ Key ត្រូវបានផ្ទុកឬអត់) ---
        console.log("Key Loaded (First 5 chars):", apiKey ? apiKey.substring(0, 5) : "NONE"); 
        // ----------------------------------------------------------------------
        
        // 1. Check for API Key
        if (!apiKey) {
            console.error("API Key is missing in Environment Variables.");
            return res.status(500).json({ error: "API Key is missing in server config (Check Render Environment)." });
        }
        
        // 2. Make the Gemini API Call
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // ✅ កែតម្រូវកំហុស "config" ទៅជា "generationConfig"
                generationConfig: { 
                    systemInstruction: systemInstruction || "You are an expert Math Professor. Respond in clear LaTeX format, providing step-by-step solution."
                }
            })
        });

        // 3. Handle Non-OK HTTP Status (e.g., 400 Bad Request, 403 Forbidden)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            console.error("Gemini API Non-OK Response Status:", response.status, errorData);
            return res.status(response.status).json({ 
                error: `Gemini API Error: ${errorData.error ? errorData.error.message : 'Unknown API network issue'}` 
            });
        }

        // 4. Parse the Successful Response and extract text
        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            console.error("Empty Text Content from API:", data);
            // នេះគឺជាមូលហេតុនៃ 'Empty Response' (Quota/Restriction)
            return res.status(500).json({ error: "AI returned no text content (API Key/Quota issue suspected)." });
        }

        // 5. Send the Successful Result
        res.json({ text: resultText });

    } catch (error) {
        // Catch general network or parsing errors
        console.error("--- CRITICAL SERVER ERROR LOG ---", error.message);
        res.status(500).json({ error: "Server failed to process request: " + error.message });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
