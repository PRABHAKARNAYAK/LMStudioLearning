
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import llmRoutes from './routes/llm';
import llmStreamRoutes from './routes/llmStream';
import llmToolsRoutes from './routes/llmTools';
import { guardrails } from './middleware/guardrails';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({limit:'1mb'}));
app.use(guardrails);
app.get('/health', (_req,res)=>res.json({ok:true}));
app.use('/api/llm', llmRoutes);
app.use('/api/llm', llmStreamRoutes);
app.use('/api/llm', llmToolsRoutes);
const port = Number(process.env.PORT||3000);
app.listen(port, ()=>console.log(`LLM API on http://localhost:${port}`));
