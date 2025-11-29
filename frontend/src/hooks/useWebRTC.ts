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

    const peerConnection = useRef<RTCPeerConnection | null>(null);

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
}, [socket, roomId, isStreamReady]);

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
        console.log('Connection state:', pc.connectionState);
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
    // If PC exists, we might need to add tracks, but with the new flow
    // PC should only be created AFTER this is set.
    // However, if we reconnect or something, we might need this.
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

return { remoteStream, connectionState, setLocalStream };
};
