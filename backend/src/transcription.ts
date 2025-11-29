import { Server, Socket } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function setupTranscription(io: Server) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set');
        return;
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    io.on('connection', (socket: Socket) => {
        socket.on('audio-chunk', async (payload: { roomId: string; audio: ArrayBuffer; timestamp: number }) => {
            try {
                // Convert ArrayBuffer to base64
                const buffer = Buffer.from(payload.audio);
                const base64Audio = buffer.toString('base64');

                // Use Gemini's multimodal model for audio transcription
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

                const result = await model.generateContent([
                    {
                        inlineData: {
                            mimeType: 'audio/webm',
                            data: base64Audio
                        }
                    },
                    'Transcribe this audio to text. Only return the transcribed text, nothing else.'
                ]);

                const text = result.response.text();

                if (text && text.trim().length > 0) {
                    // Broadcast to entire room (including sender)
                    io.to(payload.roomId).emit('transcript', {
                        userId: socket.id,
                        text: text.trim(),
                        timestamp: payload.timestamp,
                        isFinal: true
                    });
                }

            } catch (error: any) {
                console.error('Transcription error:', error.message);
            }
        });
    });
}
