import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Languages } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from './hooks/useWebRTC';
import { useAudioStream } from './hooks/useAudioStream';
import { RoomEntry } from './components/RoomEntry';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isTranslationOn, setIsTranslationOn] = useState(false);
  const [targetLang, setTargetLang] = useState('es');

  // Transcription state
  const [localTranscript, setLocalTranscript] = useState('');
  const [remoteTranscript, setRemoteTranscript] = useState('');

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

  const { remoteStream, connectionState, setLocalStream, logs } = useWebRTC(socket, isInRoom ? roomId : '', password, isStreamReady);
  useAudioStream(socket, isInRoom ? roomId : '', isMicOn);

  // Listen for transcripts
  useEffect(() => {
    if (!socket) return;

    socket.on('transcript', (data: { userId: string; text: string; timestamp: number; isFinal: boolean }) => {
      // If it's from me, update local transcript
      if (data.userId === socket.id) {
        setLocalTranscript(data.text);
      } else {
        // Otherwise, update remote transcript
        setRemoteTranscript(data.text);
      }

      // Request translation if enabled and it's a final transcript
      if (isTranslationOn && data.isFinal) {
        socket.emit('translate-req', {
          roomId,
          text: data.text,
          targetLang,
          originalTimestamp: data.timestamp,
          userId: data.userId
        });
      }
    });

    socket.on('translation', (data: { userId: string; translatedText: string; timestamp: number }) => {
      // Update the appropriate transcript with translation
      if (data.userId === socket.id) {
        setLocalTranscript(prev => `${prev}\n[${targetLang}]: ${data.translatedText}`);
      } else {
        setRemoteTranscript(prev => `${prev}\n[${targetLang}]: ${data.translatedText}`);
      }
    });

    return () => {
      socket.off('transcript');
      socket.off('translation');
    };
  }, [socket, isTranslationOn, targetLang, roomId]);

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
        setIsStreamReady(true);

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
  };

  if (!isInRoom) {
    return <RoomEntry socket={socket} onJoin={handleJoinRoom} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Room: {roomId}</h1>

      {/* Video Grid - Side by Side */}
      <div className="flex flex-row gap-6 w-full max-w-6xl mb-4">
        {/* Local Video Container */}
        <div className="flex-1 flex flex-col">
          <div className="relative bg-black rounded-lg overflow-hidden border border-gray-700 mb-3" style={{ aspectRatio: '16/9' }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 bg-blue-600 px-3 py-1 rounded text-sm font-semibold">
              You
            </div>
          </div>
          {/* Local Transcript */}
          <div className="bg-gray-800 rounded-lg p-3 min-h-[80px] max-h-[120px] overflow-y-auto">
            <div className="text-xs text-gray-400 mb-1">Your Transcript:</div>
            <div className="text-sm whitespace-pre-wrap">
              {localTranscript || <span className="text-gray-500 italic">Speak to see transcription...</span>}
            </div>
          </div>
        </div>

        {/* Remote Video Container */}
        <div className="flex-1 flex flex-col">
          <div className="relative bg-black rounded-lg overflow-hidden border border-gray-700 mb-3" style={{ aspectRatio: '16/9' }}>
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
            <div className="absolute top-2 left-2 bg-green-600 px-3 py-1 rounded text-sm font-semibold">
              Remote User
            </div>
          </div>
          {/* Remote Transcript */}
          <div className="bg-gray-800 rounded-lg p-3 min-h-[80px] max-h-[120px] overflow-y-auto">
            <div className="text-xs text-gray-400 mb-1">Remote Transcript:</div>
            <div className="text-sm whitespace-pre-wrap">
              {remoteTranscript || <span className="text-gray-500 italic">Waiting for remote user...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 bg-gray-800 p-4 rounded-full mb-4">
        <button
          onClick={() => setIsMicOn(!isMicOn)}
          className={`p-3 rounded-full ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <Mic /> : <MicOff />}
        </button>

        <button
          onClick={() => setIsCamOn(!isCamOn)}
          className={`p-3 rounded-full ${isCamOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
          title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
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

      {/* Debug Logs */}
      <div className="w-full max-w-6xl bg-gray-800 p-4 rounded text-xs font-mono h-32 overflow-y-auto opacity-50 hover:opacity-100 transition-opacity">
        <h3 className="font-bold mb-2 text-gray-400">Debug Logs</h3>
        {logs.map((log, i) => (
          <div key={i} className="mb-1">{log}</div>
        ))}
      </div>
    </div>
  );
}

export default App;
