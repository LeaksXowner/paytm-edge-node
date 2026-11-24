// Supabase Edge Function for Paytm Status Check
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GATEWAY_URL = 'https://securegw.paytm.in/merchant-status/getTxnStatus';

const CHROME_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site'
};

async function getEgressIps() {
  let ipv4 = 'N/A';
  let ipv6 = 'N/A';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const [v4Res, v6Res] = await Promise.allSettled([
      fetch('https://api.ipify.org?format=json', { signal: controller.signal }).then(r => r.json()),
      fetch('https://api64.ipify.org?format=json', { signal: controller.signal }).then(r => r.json())
    ]);
    clearTimeout(timer);
    if (v4Res.status === 'fulfilled' && v4Res.value?.ip) {
      const ip = String(v4Res.value.ip).trim();
      if (ip.includes('.')) ipv4 = ip;
    }
    if (v6Res.status === 'fulfilled' && v6Res.value?.ip) {
      const ip = String(v6Res.value.ip).trim();
      if (ip.includes(':')) ipv6 = ip;
      else if (ipv4 === 'N/A' && ip.includes('.')) ipv4 = ip;
    }
  } catch (e) {}
  return { ipv4, ipv6 };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
      }
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  let mid = url.searchParams.get('mid') || url.searchParams.get('MID');
  let oid = url.searchParams.get('oid') || url.searchParams.get('order_id') || url.searchParams.get('ORDERID');

  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (!mid) mid = body.mid || body.MID;
      if (!oid) oid = body.oid || body.order_id || body.ORDERID;
    } catch (e) {}
  }

  if (!mid || !oid) {
    if (path.endsWith('/health') || path.endsWith('/ping') || (!mid && !oid)) {
      return jsonResponse({ status: 'ok', node: 'supabase-edge-node', time: new Date().toISOString() });
    }
    return jsonResponse({ STATUS: 'ERROR', MSG: "Missing required 'mid' or 'oid'" }, 422);
  }

  const cleanMid = String(mid).trim();
  const cleanOid = String(oid).trim();

  const [ips, gatewayResult] = await Promise.all([
    getEgressIps(),
    (async () => {
      let data = null;
      let lastErr = '';
      const retryDelays = [0, 500];

      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        try {
          const resp = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: CHROME_HEADERS,
            body: JSON.stringify({ MID: cleanMid, ORDERID: cleanOid }),
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (resp.status === 200) {
            const json = await resp.json().catch(() => null);
            if (json && json.STATUS && json.STATUS !== 'ERROR') {
              return { data: json, lastErr: '' };
            }
          }
          lastErr = await resp.text().catch(() => '');
        } catch (e: any) {
          clearTimeout(timeout);
          lastErr = e.message;
        }
      }
      return { data, lastErr };
    })()
  ]);

  if (!gatewayResult.data || gatewayResult.data.STATUS === 'ERROR') {
    return jsonResponse({
      STATUS: 'ERROR',
      MSG: 'Paytm Gateway Error',
      DETAIL: gatewayResult.lastErr ? gatewayResult.lastErr.slice(0, 200) : 'Akamai WAF or Gateway rejection',
      NODE: 'supabase-edge-node',
      WORKER_IPV4: ips.ipv4,
      WORKER_IPV6: ips.ipv6
    }, 502);
  }

  const d = gatewayResult.data;
  return jsonResponse({
    BANKTXNID: d.BANKTXNID || 'N/A',
    ORDERID: String(d.ORDERID || cleanOid).trim(),
    STATUS: d.STATUS || 'UNKNOWN',
    TXNAMOUNT: d.TXNAMOUNT || 'N/A',
    TXNDATE: d.TXNDATE || 'N/A',
    TXNID: d.TXNID || 'N/A',
    WORKER_IPV4: ips.ipv4,
    WORKER_IPV6: ips.ipv6,
    NODE: 'supabase-edge-node'
  });
});
