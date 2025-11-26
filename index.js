const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ប្រើ Model ថ្មីដែលមានស្ថេរភាព
const MODEL_NAME = 'gemini-pro';

app.get('/', (req, res) => {
    res.send('✅ Server is Running! Ready to solve math.');
});

// Route ដោះស្រាយលំហាត់
app.post('/api/solve-integral', async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key not found in Environment Variables");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No result found.";
        res.json({ text });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route សម្រាប់ Chat
app.post('/api/chat-message', async (req, res) => {
    try {
        const { message, history } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key not found");

        // បង្កើត History សម្រាប់ការសន្ទនា
        const contents = history.map(h => ({ role: h.role, parts: h.parts }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating response.";
        res.json({ text });

    } catch (error) {
        console.error("Chat Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
