
import { Router } from 'express';
import { getClient } from '../client';
import { loadManuals, search as searchManuals } from '../utils/manualSearch';

const router = Router();
loadManuals();

router.get('/alarms/:code', async (req, res)=>{
  try{
    const { code } = req.params;
    const { model, firmware } = req.query as { model?: string; firmware?: string };
    const client = await getClient();
    const a = await client.getAlarmInfo(code, { model, firmware });
    res.json({ code: a.code || code, title: a.title, causes: a.causes||[], actions: a.checks||[], manual_ref: a.citation });
  }catch(e:any){ res.status(500).json({ error: e.message }); }
});

router.get('/params/:name', async (req, res)=>{
  try{
    const { name } = req.params;
    const client = await getClient();
    const p = await client.getParamInfo(name);
    res.json({ name: p.name||name, description: p.description, unit: p.unit, min: p.min, max: p.max, default: p.default, manual_ref: p.citation });
  }catch(e:any){ res.status(500).json({ error: e.message }); }
});

router.get('/manuals/search', async (req, res)=>{
  try{
    const q = String(req.query.q||''); const k = Number(req.query.k||5);
    const items = searchManuals(q, k);
    res.json(items);
  }catch(e:any){ res.status(500).json({ error: e.message }); }
});

export default router;
