# ⚡ Paytm Gateway Edge Node

Ultra-fast, zero-dependency, lightweight edge node designed for **hedged fan-out queries** against the Paytm Transaction Status Gateway.

Runs natively with 0ms cold starts across:
- **Cloudflare Workers**
- **Vercel Edge Functions** (`bom1` Mumbai region)
- **Deno Deploy**
- **Supabase Edge Functions**
- **Netlify Edge Functions**

---

## 🚀 How It Works
1. Accepts `GET /?mid=<MID>&oid=<ORDER_ID>` or `POST /` with JSON `{ "mid": "...", "oid": "..." }`.
2. Emits Chrome 124 BoringSSL headers directly to `https://securegw.paytm.in/merchant-status/getTxnStatus`.
3. Performs parallel non-blocking egress IP lookup.
4. Returns standardized, clean transaction status JSON:
```json
{
  "BANKTXNID": "629472771092",
  "ORDERID": "M-7581432755-AV5C6",
  "STATUS": "TXN_SUCCESS",
  "TXNAMOUNT": "49.00",
  "TXNDATE": "2026-10-21 20:37:17.0",
  "TXNID": "20261021111080000319765594677663066",
  "WORKER_IPV4": "N/A",
  "WORKER_IPV6": "2a06:98c0:3600::103",
  "NODE": "cf-node-1"
}
```

---

## 📦 Deployment Options

### Option 1: Cloudflare Workers (Deploy 3x for free)
You can deploy this worker multiple times under different names on your Cloudflare account to get completely separate V8 isolates and edge connection pools:
1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create Application** → **Pages / Workers**.
2. Connect this GitHub repository.
3. Deploy Worker 1: name it `paytm-node-1`
4. Deploy Worker 2: name it `paytm-node-2`
5. Deploy Worker 3: name it `paytm-node-3`
*(Or using CLI: `npx wrangler deploy --name paytm-node-1`)*

### Option 2: Vercel Edge Runtime (Deploy 2x in Mumbai `bom1`)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import this repository.
3. Project Name: `paytm-edge-1` (Framework Preset: Other).
4. Click **Deploy**. Vercel will run `api/index.js` in the **Mumbai (`bom1`)** edge region!
5. Repeat for `paytm-edge-2`.

### Option 3: Deno Deploy (Ultra-Fast 100k free req/day)
1. Go to [dash.deno.com](https://dash.deno.com).
2. Click **New Project** → Link this GitHub repository.
3. Entrypoint: `index.js`.
4. Deploy instantly.

### Option 4: Supabase Edge Functions (AWS Mumbai `ap-south-1`)
1. Create a free project in Supabase located in **Mumbai (ap-south-1)**.
2. Run `supabase functions deploy status --no-verify-jwt`.

---

## 🩺 Health Check
Check node health anytime:
```bash
curl https://<your-node-url>/health
```
Output:
```json
{
  "status": "ok",
  "node": "cf-node-1",
  "time": "2026-11-24T16:50:00.000Z"
}
```
