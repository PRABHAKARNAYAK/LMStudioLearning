
# Path A Suite — LM Studio + MotionMasterClient HTTP Wrapper

Projects:
- motionmaster-api/ (HTTP wrapper)
- synapticon-llm-express/ (LLM server)

## Quick Start
A) Wrapper (mock):
```
cd motionmaster-api
cp .env.example .env
npm install
npm run dev
# => http://localhost:4000
```
B) LM Studio:
- Start server (http://localhost:1234/v1) and select model

C) LLM API:
```
cd ../synapticon-llm-express
cp .env.example .env
npm install
npm run dev
# => http://localhost:3000
```
D) Test:
```
curl.exe -X POST http://localhost:3000/api/llm/chat-tools -H "Content-Type: application/json" -d "{"question":"For Lexium38i, what are typical causes of alarm E123 and which section covers it?"}"
```

## Real client
Set motionmaster-api/.env:
```
MMC_MODE=real
MMC_MODULE=file:///C:/Data/SET/lexium38i_2/src/Lexium38i_BIC/services/SE.IA.Lexium38i.MotionMasterClient/dist/index.js
MMC_HOST=127.0.0.1
MMC_PORT=502
```
