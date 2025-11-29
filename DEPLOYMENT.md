# Deployment Guide

You can deploy this application for free using **Render** (for the Backend) and **Vercel** (for the Frontend).

## 1. Backend Deployment (Render)

Render offers a free tier for Node.js services.

1.  **Push your code to GitHub**: Make sure your project is in a GitHub repository.
2.  **Sign up/Login to [Render](https://render.com/)**.
3.  **Create a new Web Service**:
    *   Connect your GitHub repository.
    *   **Root Directory**: `backend` (Important! This tells Render to look in the backend folder).
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Environment Variables**: Add the following:
        *   `GROQ_API_KEY`: Your Groq API Key.
        *   `CLOUD_TRANSLATE_KEY`: Your Google Cloud Translate Key.
        *   `NODE_VERSION`: `18` (Optional, but good practice).
4.  **Deploy**: Click "Create Web Service".
5.  **Copy the URL**: Once deployed, copy the backend URL (e.g., `https://your-app-backend.onrender.com`).

## 2. Frontend Deployment (Vercel)

Vercel is excellent for React/Vite apps.

1.  **Sign up/Login to [Vercel](https://vercel.com/)**.
2.  **Add New Project**:
    *   Import your GitHub repository.
3.  **Configure Project**:
    *   **Root Directory**: Edit this and select `frontend`.
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Environment Variables**:
        *   `VITE_BACKEND_URL`: Paste your Render Backend URL here (e.g., `https://your-app-backend.onrender.com`).
4.  **Deploy**: Click "Deploy".

## 3. Testing

Once both are deployed:
1.  Open the **Vercel URL** in two different browsers/devices.
2.  Create a room and join.
3.  **Note**: The free tier of Render spins down after inactivity. The first request might take 50+ seconds to wake it up. Be patient on the first load!
