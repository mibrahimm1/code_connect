import { Server, Socket } from 'socket.io';
import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

export function setupTranscription(io: Server) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    io.on('connection', (socket: Socket) => {
        socket.on('audio-chunk', async (payload: { roomId: string; audio: ArrayBuffer; timestamp: number }) => {
            try {
                if (!GROQ_API_KEY) {
                    console.error('GROQ_API_KEY is not set');
                    return;
                }

                // Convert ArrayBuffer to Buffer
                const buffer = Buffer.from(payload.audio);

                // Create a readable stream from the buffer
                const stream = Readable.from(buffer);
                // Hack to give the stream a path/filename so form-data knows it's a file
                (stream as any).path = 'audio.webm';

                const formData = new FormData();
                formData.append('file', stream, { filename: 'audio.webm', contentType: 'audio/webm' });
                formData.append('model', 'whisper-large-v3');
                formData.append('response_format', 'json');
                formData.append('language', 'en');

                const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    }
                });

                const text = response.data.text;
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
                console.error('Transcription error:', error.response?.data || error.message);
            }
        });
    });
}
