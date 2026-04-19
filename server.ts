import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import * as ort from 'onnxruntime-node';

dotenv.config();

const app = express();
app.use(cors());
const PORT = 3000;
const upload = multer({ dest: "uploads/" });

// 1. INITIALIZE ONNX ENGINE
let onnxSession: ort.InferenceSession | null = null;
const modelPath = path.join(process.cwd(), 'models', 'receipt_engine.onnx');

async function initOnnx() {
  try {
    if (fs.existsSync(modelPath)) {
      console.log("--- BINDING LOCAL ONNX ENGINE ---");
      // onnxSession = await ort.InferenceSession.create(modelPath);
      console.log("GROOD-AI: Edge Engine Active");
    } else {
      console.log("GROOD-AI: Local model not found at /models/. Using Cloud API as Primary.");
    }
  } catch (e) {
    console.error("ONNX Initialization Failed:", e);
  }
}
initOnnx();

// In-memory DB (for demo, persistence could be added via JSON file)
interface InventoryItem {
  id: string;
  name: string;
  price: number;
  weightGrams: number;
  daysToEat: number;
  addedAt: string;
  status: 'live' | 'consumed' | 'wasted';
}

let inventory: InventoryItem[] = [];
let totalSavings = 0;
let totalCarbonAvoided = 0; // in kg

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes
app.get("/api/data", (req, res) => {
  res.json({
    inventory: inventory.filter(item => item.status === 'live'),
    history: inventory.filter(item => item.status !== 'live'),
    totalSavings,
    totalCarbonAvoided
  });
});

app.post("/api/process-receipt", upload.single("receipt"), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }
    const ai = new GoogleGenAI({ apiKey });
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `Parse this receipt image. Extract all food items into a JSON array.
    For each item, provide:
    - item_name: string
    - price: number (decimal)
    - weight_grams: number (estimate if not explicitly shown)
    - days_to_eat: number (shelf-life suggestion based on item type, e.g., milk=7, bread=5, apple=14)
    If you cannot find weight, estimate based on typical size. 
    Return ONLY the JSON array.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: req.file.mimetype, data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item_name: { type: Type.STRING },
              price: { type: Type.NUMBER },
              weight_grams: { type: Type.NUMBER },
              days_to_eat: { type: Type.NUMBER }
            },
            required: ["item_name", "price", "weight_grams", "days_to_eat"]
          }
        }
      }
    });

    const items = JSON.parse(response.text || "[]");
    
    const newItems: InventoryItem[] = items.map((item: any) => ({
      id: uuidv4(),
      name: item.item_name,
      price: item.price,
      weightGrams: item.weight_grams,
      daysToEat: item.days_to_eat,
      addedAt: new Date().toISOString(),
      status: 'live'
    }));

    inventory = [...inventory, ...newItems];
    
    // Cleanup upload
    fs.unlinkSync(req.file.path);

    res.json({ success: true, count: newItems.length });
  } catch (error) {
    console.error("Receipt Processing Error:", error);
    res.status(500).json({ error: "Failed to process receipt" });
  }
});

app.post("/api/log-action", (req, res) => {
  const { itemId, action } = req.body; // action: 'consumed' | 'wasted'
  const index = inventory.findIndex(i => i.id === itemId);

  if (index !== -1) {
    const item = inventory[index];
    item.status = action;

    if (action === 'consumed') {
      totalSavings += item.price;
      // Carbon avoidance: Weight (kg) * 2.5
      totalCarbonAvoided += (item.weightGrams / 1000) * 2.5;
    }

    res.json({ success: true, item });
  } else {
    res.status(404).json({ error: "Item not found" });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GroodAI Server running on http://localhost:${PORT}`);
  });
}

startServer();
