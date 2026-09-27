import { ImageResponse } from "next/og";

export const alt = "Quittio — quittances de loyer automatiques et gestion locative simple";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0f0f1a 0%, #1f1650 60%, #3b2bb8 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#7c6cf0,#4a33c9)", display: "flex" }} />
          <div style={{ fontSize: 44, fontWeight: 700 }}>Quittio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Vos loyers gérés en pilote automatique.</div>
          <div style={{ fontSize: 32, color: "#c9c4f5" }}>Quittances envoyées · relances d&apos;impayés · révision IRL</div>
        </div>
        <div style={{ fontSize: 26, color: "#a9a3e0" }}>Essai gratuit 14 jours · dès 4,90 €/mois</div>
      </div>
    ),
    size,
  );
}
