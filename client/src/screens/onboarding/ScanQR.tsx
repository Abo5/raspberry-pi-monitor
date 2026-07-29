// Onboarding — Scan pairing QR (§4.1). Camera + reticle; the decoded blob
// starts the handshake, whose four milestones render as a rail. In the
// simulator (no camera) the manual/simulated path is available.
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';
import { EmptyState } from '../../components/States';
import { randomHex, wordsFromHex } from '../../lib/fingerprint';

const MILESTONES = ['Transport up', 'Handshake sent', 'Handshake complete', 'Channel open'];

export function ScanQR() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [milestone, setMilestone] = useState(-1); // -1 = scanning
  const scanned = useRef(false);

  // A real Agent QR encodes { ip, port, token } — route straight to the real
  // connect screen with the fields prefilled. Anything else is treated as demo.
  const onScan = (data: string) => {
    if (scanned.current) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.ip && parsed.port && parsed.token) {
        scanned.current = true;
        Haptics.selectionAsync();
        nav.navigate('AddRealPi', { endpoint: { ip: String(parsed.ip), port: String(parsed.port), token: String(parsed.token) } });
        setTimeout(() => (scanned.current = false), 800);
        return;
      }
    } catch {
      // not a real-Pi QR — fall through to the demo handshake
    }
    startHandshake();
  };

  const startHandshake = () => {
    if (scanned.current) return;
    scanned.current = true;
    Haptics.selectionAsync();
    const hex = randomHex(32);
    let m = 0;
    setMilestone(0);
    const timer = setInterval(() => {
      m += 1;
      setMilestone(m);
      if (m >= 3) {
        clearInterval(timer);
        setTimeout(() => {
          scanned.current = false;
          setMilestone(-1);
          nav.navigate('Verify', { hex, words: wordsFromHex(hex) });
        }, 350);
      }
    }, 380);
  };

  const cameraDenied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Screen>
      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius.l,
          overflow: 'hidden',
          backgroundColor: c.surface.sunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {permission?.granted ? (
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={milestone === -1 ? (r: { data: string }) => onScan(r.data) : undefined}
          />
        ) : cameraDenied ? (
          <EmptyState
            icon="camera-outline"
            title="Camera access is off"
            body="Turn it on in Settings, or enter the code by hand."
          />
        ) : (
          <EmptyState
            icon="qr-code-outline"
            title="Camera needed to scan"
            body="Point the camera at the QR code on your Pi's screen."
            actionLabel="Allow camera"
            onAction={() => requestPermission()}
          />
        )}

        {/* Reticle: 4 corner marks in accent */}
        {milestone === -1 &&
          permission?.granted &&
          [
            { top: 24, left: 24, borderTopWidth: 2, borderLeftWidth: 2 },
            { top: 24, right: 24, borderTopWidth: 2, borderRightWidth: 2 },
            { bottom: 24, left: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
            { bottom: 24, right: 24, borderBottomWidth: 2, borderRightWidth: 2 },
          ].map((pos, i) => (
            <View
              key={i}
              style={{ position: 'absolute', width: 28, height: 28, borderColor: c.accent.base, ...pos }}
            />
          ))}

        {milestone >= 0 && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              backgroundColor: c.surface.scrim,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {MILESTONES.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 40,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: i <= milestone ? c.accent.base : c.surface.raised2,
                  }}
                />
              ))}
            </View>
            <Text style={[type.callout, { color: c.text.primary }]}>Reaching your Pi…</Text>
            <Text style={[type.footnote, { color: c.text.secondary, marginTop: 4 }]}>
              {MILESTONES[Math.min(milestone, 3)]}
            </Text>
          </View>
        )}
      </View>

      <Text style={[type.callout, { color: c.text.secondary, textAlign: 'center', marginTop: 16 }]}>
        Point the camera at the QR code on your Pi's screen.
      </Text>

      <View style={{ borderTopWidth: 1, borderTopColor: c.border.hairline, marginTop: 20, paddingTop: 8 }}>
        <ActionButton label="Connect to a Pi on my network" variant="secondary" onPress={() => nav.navigate('AddRealPi', {})} />
        <ActionButton label="Use a demo Pi (no hardware)" variant="tertiary" onPress={startHandshake} />
      </View>
    </Screen>
  );
}
