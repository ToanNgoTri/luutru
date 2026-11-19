/**
 * guiCanhBao — Supabase (trigger canh_bao_gui_push, qua pg_net) gọi khi có cảnh báo
 * nghi trùng truy nã; function gửi FCM tới máy của cán bộ phụ trách + Trưởng/Phó CA cùng đơn vị + dev.
 *
 * Body: { tokens: string[], title, body, data: { kind, canhBaoId } }
 * Header bắt buộc: x-luutru-secret = CANH_BAO_SECRET (functions/.env, khớp bảng cau_hinh).
 */
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.guiCanhBao = onRequest(
    {region: "asia-southeast1", cors: false, maxInstances: 5},
    async (req, res) => {
      if (req.method !== "POST") return res.status(405).send("POST only");
      const secret = process.env.CANH_BAO_SECRET;
      if (!secret || req.get("x-luutru-secret") !== secret) {
        return res.status(401).send("unauthorized");
      }
      const {tokens, title, body, data} = req.body || {};
      const ds = Array.isArray(tokens) ? tokens.filter((t) => typeof t === "string" && t) : [];
      if (!ds.length) return res.json({gui: 0});

      const strData = Object.fromEntries(
          Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
      );
      const kq = await admin.messaging().sendEachForMulticast({
        tokens: ds.slice(0, 500),
        notification: {title: String(title || "Cảnh báo truy nã"), body: String(body || "")},
        data: strData,
        android: {
          priority: "high",
          notification: {channelId: "canh-bao-truy-na", sound: "default", priority: "max"},
        },
        apns: {payload: {aps: {sound: "default"}}},
      });
      const loi = kq.responses
          .map((r, i) => (r.success ? null : {token: ds[i].slice(0, 12), loi: r.error?.code}))
          .filter(Boolean);
      return res.json({gui: kq.successCount, loi});
    },
);
