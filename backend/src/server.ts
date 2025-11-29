import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSignaling } from './signaling';
import { setupTranscription } from './transcription';
import { setupTranslation } from './translation';


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for MVP
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Video Calling MVP Backend');
});

setupSignaling(io);
setupTranscription(io);
setupTranslation(io);

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
