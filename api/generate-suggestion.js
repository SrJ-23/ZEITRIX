
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    // Configuración de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { description } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', // Using a stable model or keeping what was there if valid
            contents: `Como profesor, mejora este reporte escolar para que sea profesional, constructivo y claro. Reporte original: "${description}"`,
            config: {
                systemInstruction: "Eres un asesor pedagógico que ayuda a profesores a redactar reportes escolares claros y profesionales."
            }
        });

        // Handle response structure from @google/genai
        if (response && response.text) {
            return res.status(200).json({ suggestion: response.text });
        } else {
            // Fallback for some response structures
            return res.status(200).json({ suggestion: JSON.stringify(response) });
        }

    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Error generating content: ' + error.message });
    }
}
