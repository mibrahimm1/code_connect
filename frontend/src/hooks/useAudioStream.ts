import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export const useAudioStream = (socket: Socket | null, roomId: string, isMicOn: boolean) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isSpeakingRef = useRef(false);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!socket || !isMicOn || !roomId) {
            stopRecording();
            return;
        }

        startVAD();

        return () => {
            stopRecording();
        };
    }, [socket, isMicOn, roomId]);

    const startVAD = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Setup AudioContext for VAD
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyserRef.current = analyser;

            analyser.fftSize = 2048;
            source.connect(analyser);

            // Start monitoring audio levels
            monitorAudioLevel();
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;

            // Voice activity threshold (adjust if needed)
            const SPEECH_THRESHOLD = 30;
            const isSpeaking = average > SPEECH_THRESHOLD;

            if (isSpeaking && !isSpeakingRef.current) {
                // Speech started
                console.log('Speech detected, starting recording...');
                isSpeakingRef.current = true;
                startRecording();

                // Clear any existing silence timeout
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                }
            } else if (!isSpeaking && isSpeakingRef.current) {
                // Potential silence, wait 1.5s before stopping
                if (!silenceTimeoutRef.current) {
                    silenceTimeoutRef.current = setTimeout(() => {
                        console.log('Silence detected, stopping recording...');
                        isSpeakingRef.current = false;
                        stopAndSendRecording();
                        silenceTimeoutRef.current = null;
                    }, 1500);
                }
            } else if (isSpeaking && silenceTimeoutRef.current) {
                // Speech resumed, cancel silence timeout
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
            }

            // Continue monitoring
            requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
    };

    const startRecording = () => {
        if (!streamRef.current || mediaRecorderRef.current) return;

        try {
            const mediaRecorder = new MediaRecorder(streamRef.current, {
                mimeType: 'audio/webm'
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start();
        } catch (error) {
            console.error('Error starting MediaRecorder:', error);
        }
    };

    const stopAndSendRecording = async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        return new Promise<void>((resolve) => {
            const mediaRecorder = mediaRecorderRef.current!;

            mediaRecorder.onstop = async () => {
                if (chunksRef.current.length > 0 && socket) {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

                    // Only send if blob is substantial (> 0.5 seconds of audio)
                    if (blob.size > 5000) {
                        const buffer = await blob.arrayBuffer();
                        console.log('Sending audio chunk for transcription...');
                        socket.emit('audio-chunk', {
                            roomId,
                            audio: buffer,
                            timestamp: Date.now()
                        });
                    }
                }

                chunksRef.current = [];
                mediaRecorderRef.current = null;
                resolve();
            };

            mediaRecorder.stop();
        });
    };

    const stopRecording = () => {
        // Clear silence timeout
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }

        // Stop media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Stop stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        isSpeakingRef.current = false;
    };
};
