/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: token/App.tsx
   QUÉ CAMBIÓ: el contenedor del screen pasó de overflow:"hidden" a no tener
                overflow, y se añadió minHeight:0.
   POR QUÉ: en un contenedor flex con overflow:"hidden", el hijo con
            flex:1 puede quedar con minHeight:auto (valor por defecto),
            lo que le impide encogerse y hace que el div .scrollable no
            tenga una altura acotada — sin altura acotada, overflow-y:auto
            nunca activa el scroll porque el contenido "nunca" desborda.
            Con minHeight:0 el flex-child se encoge a su espacio asignado
            y el .scrollable interior puede hacer scroll correctamente.
            Se quita overflow:"hidden" porque el clip decorativo de los
            blobs ya lo hace el contenedor exterior (el que tiene
            overflow:"hidden" en el div raíz).
   ─────────────────────────────────────────────────────────────────────────── */

import { AppProvider, useApp } from "@/context/AppContext";
import BottomTabBar from "@/components/BottomTabBar";
import DiscoveryPage from "@/features/tokens/DiscoveryPage";
import TokenPage from "@/features/tokens/TokenPage";
import AirdropPage from "@/features/airdrops/AirdropPage";
import UserProfile from "@/features/user/UserProfile";
import CreatorDashboard from "@/features/creator/CreatorDashboard";

function SplashScreen() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0e14",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#8b5cf6,#06d6f7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          marginBottom: 20,
          boxShadow: "0 0 32px rgba(139,92,246,0.5)",
        }}
      >
        🌍
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#e8e9f0", marginBottom: 8 }}>
        Token Market
      </h1>
      <p style={{ fontSize: 13, color: "#888" }}>Connecting to World App...</p>
    </div>
  );
}

function AppShell() {
  const { screen, isCreatorModalOpen, worldAppReady } = useApp();

  if (!worldAppReady) return <SplashScreen />;

  const renderScreen = () => {
    switch (screen) {
      case "discovery": return <DiscoveryPage />;
      case "token": return <TokenPage />;
      case "airdrops": return <AirdropPage />;
      case "profile": return <UserProfile />;
      default: return <DiscoveryPage />;
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: "#0d0e14",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: -100,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(6,214,247,0.06) 0%,transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── CAMBIO: se eliminó overflow:"hidden" y se añadió minHeight:0 ── */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0 }}>
        {renderScreen()}
      </div>

      <BottomTabBar />

      {isCreatorModalOpen && <CreatorDashboard />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
