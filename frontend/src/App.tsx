import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Languages } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from './hooks/useWebRTC';
import { useAudioStream } from './hooks/useAudioStream';
import { Captions } from './components/Captions';
import { RoomEntry } from './components/RoomEntry';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState(''); // Store password
  const [isInRoom, setIsInRoom] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isTranslationOn, setIsTranslationOn] = useState(false);
  const [targetLang, setTargetLang] = useState('es');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize socket once
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const newSocket = io(backendUrl);
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Pass isStreamReady to useWebRTC
  const { remoteStream, connectionState, setLocalStream } = useWebRTC(socket, isInRoom ? roomId : '', password, isStreamReady);
  useAudioStream(socket, isInRoom ? roomId : '', isMicOn);

  useEffect(() => {
    if (!isInRoom) return;

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setLocalStream(stream);
        setIsStreamReady(true); // Signal that stream is ready

        stream.getAudioTracks().forEach(track => track.enabled = isMicOn);
        stream.getVideoTracks().forEach(track => track.enabled = isCamOn);

      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };

    startLocalStream();
  }, [isInRoom]);

  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => track.enabled = isMicOn);
      stream.getVideoTracks().forEach(track => track.enabled = isCamOn);
    }
  }, [isMicOn, isCamOn]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleJoinRoom = (id: string, pass?: string) => {
    setRoomId(id);
    setPassword(pass || '');
    setIsInRoom(true);
    // RoomEntry validated the room, but we wait for the stream to be ready before joining via WebRTC.
    // This avoids the race condition where we negotiate before having tracks.
  };

  if (!isInRoom) {
    return <RoomEntry socket={socket} onJoin={handleJoinRoom} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Room: {roomId}</h1>

      {/* Force side-by-side layout with flex-row */}
      <div className="flex flex-row gap-4 w-full max-w-6xl mb-4 relative h-[60vh]">
        {/* Local Video */}
        <div className="flex-1 relative bg-black rounded-lg overflow-hidden border border-gray-700">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">You</div>
        </div>

        {/* Remote Video */}
        <div className="flex-1 relative bg-black rounded-lg overflow-hidden border border-gray-700">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Waiting for peer... ({connectionState})
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">Remote</div>
        </div>

        {/* Captions Overlay - Centered at bottom of container */}
        <Captions
          socket={socket}
          roomId={roomId}
          isTranslationOn={isTranslationOn}
          targetLang={targetLang}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-4 bg-gray-800 p-4 rounded-full">
        <button
          onClick={() => setIsMicOn(!isMicOn)}
          className={`p-3 rounded-full ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {isMicOn ? <Mic /> : <MicOff />}
        </button>

        <button
          onClick={() => setIsCamOn(!isCamOn)}
          className={`p-3 rounded-full ${isCamOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {isCamOn ? <Video /> : <VideoOff />}
        </button>

        <div className="flex items-center gap-2 bg-gray-700 px-4 rounded-full">
          <Languages size={20} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTranslationOn}
              onChange={(e) => setIsTranslationOn(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Translate</span>
          </label>

          {isTranslationOn && (
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1 border-none outline-none"
            >
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
