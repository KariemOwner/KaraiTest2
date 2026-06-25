/**
 * Chat API Handler - Vercel Serverless Function
 * Handles chat requests to Groq API with llama-3.3-70b-versatile
 */

// System prompt for Chat mode - controlled sarcasm, helpful first
const CHAT_SYSTEM_PROMPT = `Kamu adalah KarAI, temen curhat orang Indonesia yang sarkas tapi berguna. Tagline: "Sarkas tapi berguna".

PERSONALITY:
- Casual Indonesian slang (gue/lo, gak, sih, dong, dll)
- Funny sarcasm tapi nggak nyakitin hati
- Roasting kayak temen deket, bukan musuh
- Tetap helpful dan kasih solusi nyata
- Nggak terlalu panjang, to the point

RULES:
1. Dengerin dulu masalah user
2. Kasih respons sarkas dikit sebagai pembuka
3. Langsung kasih solusi atau jawaban yang berguna
4. Jangan jadi toxic, tetap friendly
5. Kalau user tanya hal serius, kurangi sarkas dan fokus bantu
6. Pakai emoji secukupnya biar nggak kaku

CONTOH GAYA:
- "Waduh, klasik banget masalah lo. Tapi ya udahlah, gue bantu nih..."
- "Serius nanya beginian? Yaudah deh, dengerin baik-baik ya..."
- "Hmm, sebenarnya ini gampang sih. Tapi karena lo tanya, gue jelasin pelan-pelan..."

JANGAN:
- Terlalu panjang lebar
- Sarkas berlebihan sampai nyakitin
- Menghakimi user
- Jawab dengan "saya AI" atau sejenisnya`;

export default async function handler(request, response) {
    // CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Only allow POST
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, conversation_id, mode, action, guest_session_id } = request.body;

        // Handle guest limit check
        if (action === 'check_limit') {
            return await handleCheckLimit(request, response, guest_session_id);
        }

        // Handle guest usage increment
        if (action === 'increment_usage') {
            return await handleIncrementUsage(request, response, guest_session_id);
        }

        // Validate message
        if (!message || typeof message !== 'string') {
            return response.status(400).json({ error: 'Message is required' });
        }

        // Check for image generation command
        if (message.includes('[GENERATE_IMAGE:')) {
            return handleImageGeneration(message);
        }

        // Get Groq API key
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            console.error('GROQ_API_KEY not configured');
            return response.status(500).json({ 
                error: 'Server configuration error',
                debug: 'GROQ_API_KEY missing'
            });
        }

        // Prepare messages for Groq
        const messages = [
            { role: 'system', content: CHAT_SYSTEM_PROMPT },
            { role: 'user', content: message }
        ];

        // Call Groq API
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 1,
                stream: false
            })
        });

        if (!groqResponse.ok) {
            const errorData = await groqResponse.json();
            console.error('Groq API error:', errorData);
            
            if (groqResponse.status === 429) {
                return response.status(429).json({ error: 'Rate limit exceeded. Coba lagi nanti.' });
            }
            
            return response.status(500).json({ 
                error: 'Failed to get AI response',
                debug: errorData
            });
        }

        const groqData = await groqResponse.json();
        const aiResponse = groqData.choices?.[0]?.message?.content || 'Maaf, gue lagi error nih.';

        return response.status(200).json({ 
            response: aiResponse,
            model: 'llama-3.3-70b-versatile',
            conversation_id: conversation_id
        });

    } catch (error) {
        console.error('Chat API error:', error);
        return response.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Handle image generation command detection
 */
function handleImageGeneration(message) {
    // Extract description from command
    const match = message.match(/\[GENERATE_IMAGE:\s*(.+?)\]/);
    
    if (!match) {
        return {
            status: 400,
            json: { error: 'Invalid image generation command' }
        };
    }

    const description = match[1].trim();
    
    // Return placeholder response - actual implementation will use image generation API
    return {
        status: 200,
        json: {
            response: `Oke, gue tangkep lo mau generate gambar: "${description}".\n\nFitur image generation masih dalam pengembangan. Sabar ya! 🎨`,
            image_generation: {
                detected: true,
                description: description,
                status: 'pending'
            }
        }
    };
}

/**
 * Check guest daily limit
 */
async function handleCheckLimit(request, response, guestSessionId) {
    const GUEST_DAILY_LIMIT = parseInt(process.env.GUEST_DAILY_LIMIT) || 20;
    
    // In production, this would check Supabase database
    // For now, return a default value
    const remaining = GUEST_DAILY_LIMIT; // Simplified for demo
    
    return response.status(200).json({
        remaining: remaining,
        limit: GUEST_DAILY_LIMIT
    });
}

/**
 * Increment guest usage counter
 */
async function handleIncrementUsage(request, response, guestSessionId) {
    // In production, this would update Supabase database
    // For now, just acknowledge
    
    return response.status(200).json({
        success: true,
        message: 'Usage incremented'
    });
}
