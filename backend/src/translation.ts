import { Server, Socket } from 'socket.io';
import axios from 'axios';

export function setupTranslation(io: Server) {
    const GOOGLE_TRANSLATE_API_KEY = process.env.CLOUD_TRANSLATE_KEY || process.env.GOOGLE_API_KEY;

    io.on('connection', (socket: Socket) => {
        socket.on('translate-req', async (payload: { roomId: string; text: string; targetLang: string; originalTimestamp: number }) => {
            try {
                if (!GOOGLE_TRANSLATE_API_KEY) {
                    console.error('CLOUD_TRANSLATE_KEY is not set');
                    return;
                }

                if (!payload.text || payload.text.trim().length === 0) return;

                const response = await axios.post(
                    `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
                    {
                        q: payload.text,
                        target: payload.targetLang,
                        format: 'text'
                    }
                );

                const translations = response.data.data.translations;
                if (translations && translations.length > 0) {
                    io.to(payload.roomId).emit('translation', {
                        userId: socket.id,
                        originalText: payload.text,
                        translatedText: translations[0].translatedText,
                        timestamp: payload.originalTimestamp,
                        targetLang: payload.targetLang
                    });
                }

            } catch (error: any) {
                console.error('Translation error:', error.response?.data || error.message);
            }
        });
    });
}
