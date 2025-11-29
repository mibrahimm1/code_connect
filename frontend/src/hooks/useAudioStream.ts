import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export const useAudioStream = (socket: Socket | null, roomId: string, isMicOn: boolean) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!socket || !isMicOn || !roomId) {
            stopRecording();
            return;
        }

        startRecording();

        return () => {
            stopRecording();
        };
    }, [socket, isMicOn, roomId]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const recordSegment = () => {
                if (!streamRef.current?.active) return;

                const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorderRef.current = mediaRecorder;

                const chunks: Blob[] = [];
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    if (chunks.length > 0 && socket) {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const buffer = await blob.arrayBuffer();
                        socket.emit('audio-chunk', {
                            roomId,
                            audio: buffer,
                            timestamp: Date.now()
                        });
                    }
                    if (isMicOn && streamRef.current?.active) {
                        recordSegment(); // Start next segment
                    }
                };

                mediaRecorder.start();
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, 1000); // 1 second chunks for better validity
            };

            recordSegment();

        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };
};
