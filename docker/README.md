# Zudobot Docker Sandbox & Clone

โครงสร้างตาม **Freeze & Clone** — ยังไม่รัน Next.js production (`RUN_MODE=scaffold`)

## Quick start

```bash
copy docker\env\docker.local.env.example docker\env\local.env
# แก้ค่าใน local.env

npm run clone:export-env:dry
npm run clone:export-env          # ต้องมี AWS credentials

npm run clone:validate-env
npm run docker:up                 # zudobot-db + mongo-express + web-scaffold
```

| Service | Port | หมายเหตุ |
|---------|------|----------|
| `zudobot-db` | 27017 | MongoDB 6.0, `root` / `localsecretpassword` |
| `mongo-express` | 8081 | UI จัดการ DB |
| `web-scaffold` | 3000 | Idle scaffold, โหลด `docker/env/local.env` |

## Clone ข้อมูล MongoDB

```bash
# ใส่ MONGODB_PRODUCTION_URI ใน docker/env/local.env
npm run clone:mongodb
npm run clone:mongodb -- --execute
```

## Gitignore

- `docker/env/local.env`
- `docker/env/generated/*` (ยกเว้น `.gitkeep`)

## Amplify App ID

- Sandbox export default: `d119trnyk61q8r` (`AWS_AMPLIFY_APP_ID`)
- Legacy scripts (`db:amplify-env`): `d9czp7mb1m4w2` ใน `scripts/lib/loadAmplifyEnv.mjs`
