# LogDisco

App web (Next.js + Firebase + Vercel) para coleção de discos e diário de audições.
Especificação: `Requisitos.pdf`. Andamento: `REQUISITOS.md`.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

## Regras do Firestore
```bash
npx firebase login
npx firebase use --add       # escolha o projeto
npx firebase deploy --only firestore:rules
```

## Testes
```bash
npm test                     # unitários
npm run test:rules           # regras do Firestore (usa o emulador; precisa de Java)
```
