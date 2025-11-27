// index.js (Code សម្រាប់សាកល្បងដោយគ្មាន systemInstruction)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

const MODEL_NAME = 'gemini-2.5-flash';

app.get('/', (req, res) => {
    res.send('✅ Server is Running! Ready to solve math.');
});

app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        console.log("Key Loaded (First 5 chars):", apiKey ? apiKey.substring(0, 5) : "NONE"); 
        
        if (!apiKey) {
            console.error("API Key is missing in Environment Variables.");
            return res.status(500).json({ error: "API Key is missing in server config." });
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // ✅ លុប systemInstruction ចេញបណ្តោះអាសន្នដើម្បីជៀសវាងកំហុស Data Type
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            console.error("Gemini API Non-OK Response Status:", response.status, errorData);
            return res.status(response.status).json({ 
                error: `Gemini API Error: ${errorData.error ? errorData.error.message : 'Unknown API network issue'}` 
            });
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            console.error("Empty Text Content from API:", data);
            return res.status(500).json({ error: "AI returned no text content (API Key/Quota issue suspected)." });
        }

        res.json({ text: resultText });

    } catch (error) {
        console.error("--- CRITICAL SERVER ERROR LOG ---", error.message);
        res.status(500).json({ error: "Server failed to process request: " + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
