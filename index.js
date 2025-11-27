const express = require('express');
const cors = require('cors');
// ត្រូវការ dotenv សម្រាប់កំណត់ Environment Variables ក្នុង Local (បើមាន)
require('dotenv').config(); 

const app = express();
// កំណត់ Port សម្រាប់ Render (ត្រូវតែប្រើ process.env.PORT)
const PORT = process.env.PORT || 3000; 
const MODEL_NAME = 'gemini-2.5-flash'; // ប្រើ Model ដែលអ្នកបានកំណត់

// --- Middleware Setup ---
// អនុញ្ញាតឱ្យ Frontend ហៅមកបាន
app.use(cors()); 
// សម្រាប់ទទួលទិន្នន័យ JSON ពី Frontend (req.body)
app.use(express.json()); 

// --- Health Check Route (GET /) ---
app.get('/', (req, res) => {
    // នេះសម្រាប់ Render Health Check
    res.send('✅ Server is Running! Ready to solve math.');
});

// --- Integration Route (POST /api/solve-integral) ---
app.post('/api/solve-integral', async (req, res) => {
    // ទទួល prompt ពី Frontend (ត្រូវប្រាកដថា Frontend ផ្ញើក្នុងទម្រង់ { "prompt": "sin^4(x)" })
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // *** TRY-CATCH BLOCK: នេះជាការការពារកុំឱ្យ Server Crash ដោយស្ងាត់ៗ ***
    try {
        if (!apiKey) {
            // បើអត់មាន Key ត្រូវ throw error ដើម្បីឱ្យវាចូលទៅ catch block ហើយ Log
            throw new Error("API Key is missing. Check GEMINI_API_KEY environment variable on Render.");
        }

        if (!prompt) {
            // ផ្ទៀងផ្ទាត់ថា prompt មាន
            return res.status(400).json({ error: "Missing 'prompt' in request body." });
        }

        // រៀបចំការហៅទៅ Gemini API
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ 
                parts: [{ 
                    text: `Solve the integral: ${prompt}. Only provide the final, simplified mathematical solution without extra explanation or formatting, ready for JSON parsing.` 
                }] 
            }],
            // បើចង់កំណត់ parameters ផ្សេងៗអាចបន្ថែមនៅទីនេះ
        };

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        // ពិនិត្យមើលថា API ឆ្លើយតបដោយជោគជ័យដែរឬទេ (200 OK)
        if (!response.ok) {
            console.error('Gemini API Error Response (Not OK):', data);
            return res.status(500).json({ 
                error: 'Failed to get response from AI model. Please check Render Logs.', 
                details: data.error?.message || 'Unknown API Error' 
            });
        }

        // ដកស្រង់លទ្ធផល (តាមទម្រង់ធម្មតារបស់ Gemini)
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "Solution not found.";
        
        // ផ្ញើលទ្ធផលត្រឡប់ទៅ Frontend
        res.json({ success: true, solution: resultText });

    } catch (error) {
        // CATCH BLOCK: នេះនឹងចាប់យកកំហុស API Key ឬ Code Crash
        console.error('--- CRITICAL SERVER CRASH ERROR ---', error);
        res.status(500).json({ 
            error: 'Internal Server Error. Please check Render Logs for API Key or connection issues.',
            message: error.message 
        });
    }
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
