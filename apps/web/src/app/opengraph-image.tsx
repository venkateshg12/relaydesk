import { ImageResponse } from "next/og";

export const alt = "RelayDesk — Live Chat & Customer Support Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#09090b",
          color: "#fafafa",
          padding: "48px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          justifyContent: "space-between",
        }}
      >
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "#2450E6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "14px",
                  backgroundColor: "#ffffff",
                  borderRadius: "4px 4px 4px 1px",
                }}
              />
            </div>
            <span style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "-0.02em" }}>
              RelayDesk
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "rgba(36, 80, 230, 0.15)",
              border: "1px solid rgba(36, 80, 230, 0.4)",
              borderRadius: "9999px",
              padding: "6px 16px",
              fontSize: "14px",
              color: "#60a5fa",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
            Live Split Demo • Sub-50ms Latency
          </div>
        </div>

        {/* Main Split Mockup Preview */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            height: "360px",
            width: "100%",
            marginTop: "16px",
          }}
        >
          {/* Left panel: Sweet Crumbs */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "12px",
              border: "1px solid #27272a",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "14px", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Host Storefront & Widget
              </div>
              <div style={{ fontSize: "20px", fontWeight: "600", marginTop: "4px" }}>
                Sweet Crumbs Bakery
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  alignSelf: "flex-end",
                  backgroundColor: "#2450E6",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: "12px 12px 2px 12px",
                  fontSize: "15px",
                }}
              >
                Do you deliver to Gajuwaka?
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#27272a",
                  color: "#f4f4f5",
                  padding: "10px 16px",
                  borderRadius: "12px 12px 12px 2px",
                  fontSize: "15px",
                }}
              >
                Yes! We deliver everywhere within 15 km of MVP Colony.
              </div>
            </div>
            <div style={{ fontSize: "13px", color: "#71717a" }}>
              Seq #1 • Delivered • Just now
            </div>
          </div>

          {/* Right panel: Agent Inbox */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "12px",
              border: "1px solid #27272a",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "14px", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Agent Realtime Inbox
              </div>
              <div style={{ fontSize: "20px", fontWeight: "600", marginTop: "4px" }}>
                Active Conversation #1042
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#22c55e" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                Visitor #8491 connected (socket.io)
              </div>
              <div
                style={{
                  backgroundColor: "#27272a",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#d4d4d8",
                }}
              >
                Auto-assigned to Agent via atomic Postgres lock
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ backgroundColor: "#2450E6", borderRadius: "6px", padding: "6px 12px", fontSize: "13px" }}>
                Saved Replies (/)
              </div>
              <div style={{ backgroundColor: "#3f3f46", borderRadius: "6px", padding: "6px 12px", fontSize: "13px" }}>
                Internal Note
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #27272a", paddingTop: "16px" }}>
          <span style={{ fontSize: "16px", color: "#a1a1aa" }}>
            TypeScript • Express • Socket.IO • PostgreSQL (Neon) • Redis • Next.js
          </span>
          <span style={{ fontSize: "16px", fontWeight: "600", color: "#60a5fa" }}>
            Strict FIFO Sequence Ordering Guaranteed
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
