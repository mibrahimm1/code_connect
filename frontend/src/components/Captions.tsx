import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Transcript {
    userId: string;
    text: string;
    timestamp: number;
    isFinal: boolean;
    translatedText?: string;
    targetLang?: string;
}

interface CaptionsProps {
    socket: Socket | null;
    isTranslationOn: boolean;
    targetLang: string;
    roomId: string;
}

export const Captions: React.FC<CaptionsProps> = ({ socket, isTranslationOn, targetLang, roomId }) => {
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);

    useEffect(() => {
        if (!socket) return;

        const handleTranscript = (payload: Transcript) => {
            setTranscripts(prev => {
                // Keep last 3
                const newTranscripts = [...prev, payload];
                if (newTranscripts.length > 3) {
                    return newTranscripts.slice(newTranscripts.length - 3);
                }
                return newTranscripts;
            });

            if (isTranslationOn && targetLang) {
                socket.emit('translate-req', {
                    roomId,
                    text: payload.text,
                    targetLang,
                    originalTimestamp: payload.timestamp
                });
            }
        };

        const handleTranslation = (payload: { userId: string; translatedText: string; timestamp: number }) => {
            setTranscripts(prev => prev.map(t => {
                if (t.timestamp === payload.timestamp && t.userId === payload.userId) {
                    return { ...t, translatedText: payload.translatedText };
                }
                return t;
            }));
        };

        socket.on('transcript', handleTranscript);
        socket.on('translation', handleTranslation);

        return () => {
            socket.off('transcript', handleTranscript);
            socket.off('translation', handleTranslation);
        };
    }, [socket, isTranslationOn, targetLang, roomId]);

    return (
        <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            textAlign: 'center',
            pointerEvents: 'none'
        }}>
            {transcripts.map((t, i) => (
                <div key={i} style={{ marginBottom: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px' }}>
                    <div style={{ color: 'white', fontSize: '1.2em' }}>{t.text}</div>
                    {isTranslationOn && t.translatedText && (
                        <div style={{ color: '#aaa', fontSize: '1em', fontStyle: 'italic' }}>{t.translatedText}</div>
                    )}
                </div>
            ))}
        </div>
    );
};
