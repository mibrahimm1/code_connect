import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ],
};

export const useWebRTC = (socket: Socket | null, roomId: string, password: string, isStreamReady: boolean) => {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<string>('disconnected');
    const [logs, setLogs] = useState<string[]>([]);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
    const [isRemoteDescriptionSet, setIsRemoteDescriptionSet] = useState(false);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev.slice(-10), msg]); // Keep last 10 logs
    };

    useEffect(() => {
        if (!socket || !roomId || !isStreamReady) return;

        addLog('Ready to join room. Emitting join-room...');
        socket.emit('join-room', { roomId, password });

        socket.on('user-connected', async (userId: string) => {
            addLog(`User connected: ${userId}. Creating offer...`);
            await createOffer(userId, socket);
        });

        socket.on('offer', async (payload: { sdp: RTCSessionDescriptionInit; caller: string }) => {
            addLog(`Received offer from ${payload.caller}. Handling...`);
            await handleOffer(payload.sdp, payload.caller, socket);
        });

        socket.on('answer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
            addLog('Received answer. Handling...');
            await handleAnswer(payload.sdp);
        });

        socket.on('ice-candidate', async (payload: { candidate: RTCIceCandidateInit }) => {
            // addLog('Received ICE candidate.'); // Too verbose
            await handleIceCandidate(payload.candidate);
        });

        return () => {
            socket.off('user-connected');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');

            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
            iceCandidatesQueue.current = [];
            setIsRemoteDescriptionSet(false);
        };
    }, [socket, roomId, isStreamReady]);

    // Flush ICE queue when remote description is set
    useEffect(() => {
        if (isRemoteDescriptionSet && peerConnection.current) {
            const queueLength = iceCandidatesQueue.current.length;
            if (queueLength > 0) {
                addLog(`Flushing ${queueLength} queued ICE candidates.`);
                iceCandidatesQueue.current.forEach(async (candidate) => {
                    try {
                        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('Error adding queued ice candidate', e);
                    }
                });
                iceCandidatesQueue.current = [];
            }
        }
    }, [isRemoteDescriptionSet]);

    const createPeerConnection = (targetId: string, socket: Socket) => {
        if (peerConnection.current) return peerConnection.current;

        addLog('Creating RTCPeerConnection');
        const pc = new RTCPeerConnection(STUN_SERVERS);
        peerConnection.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { target: targetId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            addLog('Track received!');
            setRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            addLog(`Connection state changed: ${pc.connectionState}`);
            setConnectionState(pc.connectionState);
        };

        // Add local tracks if available
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        } else {
            addLog('WARNING: No local stream to add to PC!');
        }

        return pc;
    };

    const createOffer = async (targetId: string, socket: Socket) => {
        const pc = createPeerConnection(targetId, socket);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { target: targetId, sdp: offer });
    };

    const handleOffer = async (sdp: RTCSessionDescriptionInit, callerId: string, socket: Socket) => {
        const pc = createPeerConnection(callerId, socket);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        setIsRemoteDescriptionSet(true);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: callerId, sdp: answer });
    };

    const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
        if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
            setIsRemoteDescriptionSet(true);
        }
    };

    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
        if (peerConnection.current) {
            if (peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            } else {
                iceCandidatesQueue.current.push(candidate);
            }
        }
    };

    const setLocalStream = (stream: MediaStream) => {
        localStreamRef.current = stream;
        if (peerConnection.current) {
            stream.getTracks().forEach(track => {
                const sender = peerConnection.current?.getSenders().find(s => s.track?.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    peerConnection.current?.addTrack(track, stream);
                }
            });
        }
    };

    return { remoteStream, connectionState, setLocalStream, logs };
};
