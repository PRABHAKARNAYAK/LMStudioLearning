
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import synapticonRoutes from './routes/synapticon';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/synapticon', synapticonRoutes);

const port = Number(process.env.PORT || 4000);
app.listen(port, ()=>console.log(`MotionMasterClient API on http://localhost:${port}`));
