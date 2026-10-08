import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2450E6",
          borderRadius: "8px",
          position: "relative",
        }}
      >
        {/* Upper speech bubble */}
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            width: "13px",
            height: "10px",
            background: "#ffffff",
            borderRadius: "4px 4px 4px 1px",
          }}
        />
        {/* Lower offset speech bubble */}
        <div
          style={{
            position: "absolute",
            bottom: "6px",
            right: "6px",
            width: "13px",
            height: "10px",
            background: "#ffffff",
            borderRadius: "4px 4px 1px 4px",
            opacity: 0.95,
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
