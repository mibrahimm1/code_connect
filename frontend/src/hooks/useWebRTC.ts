import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN server here if available
        // { urls: 'turn:your-turn-server', username: 'user', credential: 'pass' }
    ],
};

export const useWebRTC = (socket: Socket | null, roomId: string) => {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<string>('disconnected');

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!socket || !roomId) return;

        socket.on('user-connected', async (userId: string) => {
            console.log('User connected:', userId);
            // Initiate offer
            await createOffer(userId, socket);
        });

        socket.on('offer', async (payload: { sdp: RTCSessionDescriptionInit; caller: string }) => {
            await handleOffer(payload.sdp, payload.caller, socket);
        });

        socket.on('answer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
            await handleAnswer(payload.sdp);
        });

        socket.on('ice-candidate', async (payload: { candidate: RTCIceCandidateInit }) => {
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
        };
    }, [socket, roomId]);

    const createPeerConnection = (targetId: string, socket: Socket) => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(STUN_SERVERS);
        peerConnection.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { target: targetId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            setConnectionState(pc.connectionState);
        };

        // Add local tracks if available
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
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
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: callerId, sdp: answer });
    };

    const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
        if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    };

    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
        if (peerConnection.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const setLocalStream = (stream: MediaStream) => {
        localStreamRef.current = stream;
        if (peerConnection.current) {
            // Replace tracks or add them
            // For simplicity, we assume stream is set before connection or we just add tracks
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

    return { remoteStream, connectionState, setLocalStream };
};

