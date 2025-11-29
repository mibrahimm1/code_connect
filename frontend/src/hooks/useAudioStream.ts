import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

// TypeScript interfaces for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export const useAudioStream = (socket: Socket | null, roomId: string, isMicOn: boolean) => {
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        // Check if browser supports Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Web Speech API not supported in this browser');
            setIsSupported(false);
            return;
        }

        if (!socket || !isMicOn || !roomId) {
            stopRecognition();
            return;
        }

        startRecognition();

        return () => {
            stopRecognition();
        };
    }, [socket, isMicOn, roomId]);

    const startRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        // Configuration
        recognition.continuous = true; // Keep listening
        recognition.interimResults = true; // Get partial results
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const isFinal = event.results[i].isFinal;

                // Only send if there's actual content
                if (transcript.trim().length > 0 && socket) {
                    socket.emit('transcript', {
                        roomId,
                        userId: socket.id,
                        text: transcript.trim(),
                        timestamp: Date.now(),
                        isFinal
                    });
                }
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);

            // Restart on certain errors
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                setTimeout(() => {
                    if (isMicOn && recognitionRef.current) {
                        recognition.start();
                    }
                }, 1000);
            }
        };

        recognition.onend = () => {
            // Auto-restart if mic is still on
            if (isMicOn && recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                }
            }
        };

        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    };

    const stopRecognition = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore errors when stopping
            }
            recognitionRef.current = null;
        }
    };

    return { isSupported };
};
