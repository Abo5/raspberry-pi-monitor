// Raspberry Pi — telemetry widgets for the Home Screen and Lock Screen.
// The app writes the latest telemetry snapshot + sparkline tails + connection
// state into the shared App Group (key "telemetry"). These widgets read it,
// age it honestly, and deep-link back into the app.
import SwiftUI
import WidgetKit
import Foundation

private let appGroup = "group.com.abo5.raspberryapp"

// MARK: - Model

struct TelemetryEntry: TimelineEntry {
  var date: Date
  let agentName: String
  let connection: String
  let rttMs: Double
  let producedAt: Double     // epoch ms
  let receivedAt: Double     // epoch ms
  let values: [String: Double]
  let series: [String: [[Double]]] // key -> [[t, v], ...]

  var isOnline: Bool { connection == "connected" }
  var hasData: Bool { !values.isEmpty && producedAt > 0 }

  func value(_ key: String) -> Double? { values[key] }
  func points(_ key: String) -> [SeriesPoint] {
    (series[key] ?? []).compactMap { $0.count >= 2 ? SeriesPoint(t: $0[0], v: $0[1]) : nil }
  }
}

struct SeriesPoint { let t: Double; let v: Double }

private struct TelemetryPayload: Codable {
  let agentName: String
  let agentId: String
  let connection: String
  let rttMs: Double
  let producedAt: Double
  let receivedAt: Double
  let values: [String: Double]
  let series: [String: [[Double]]]
}

private func loadEntry() -> TelemetryEntry {
  let empty = TelemetryEntry(date: .now, agentName: "Raspberry Pi", connection: "unknown",
                             rttMs: 0, producedAt: 0, receivedAt: 0, values: [:], series: [:])
  guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "telemetry"),
        let data = json.data(using: .utf8),
        let p = try? JSONDecoder().decode(TelemetryPayload.self, from: data)
  else { return empty }
  return TelemetryEntry(date: .now, agentName: p.agentName, connection: p.connection,
                        rttMs: p.rttMs, producedAt: p.producedAt, receivedAt: p.receivedAt,
                        values: p.values, series: p.series)
}

// MARK: - Provider

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> TelemetryEntry {
    TelemetryEntry(date: .now, agentName: "pi5-livingroom", connection: "connected", rttMs: 34,
                   producedAt: Date.now.timeIntervalSince1970 * 1000,
                   receivedAt: Date.now.timeIntervalSince1970 * 1000,
                   values: ["cpu.temp_c": 54.2, "cpu.util_pct": 12.4, "mem.used_pct": 38.0, "disk.used_pct": 67.0, "load.1m": 0.42],
                   series: ["cpu.temp_c": [[0, 52], [1, 53], [2, 54]], "cpu.util_pct": [[0, 10], [1, 12], [2, 11]]])
  }

  func getSnapshot(in context: Context, completion: @escaping (TelemetryEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TelemetryEntry>) -> Void) {
    let base = loadEntry()
    var entries: [TelemetryEntry] = [base]
    // Self-ageing: emit the same data at increasing future dates so the age stamp
    // advances on its own even if the app never runs again.
    let offsets: [TimeInterval] = [120, 300, 600, 900, 1800, 2700, 3600, 5400, 7200, 10800, 21600]
    for o in offsets {
      var e = base
      e.date = Date(timeIntervalSinceNow: o)
      entries.append(e)
    }
    completion(Timeline(entries: entries, policy: .after(Date(timeIntervalSinceNow: 900))))
  }
}

// MARK: - Formatting

private func ageText(_ entry: TelemetryEntry) -> String {
  guard entry.producedAt > 0 else { return "no data" }
  let age = entry.date.timeIntervalSince1970 - entry.producedAt / 1000
  if age < 30 { return "just now" }
  if age < 3600 { return "\(Int(age / 60)) min ago" }
  if age < 86400 {
    let h = Int(age / 3600)
    let m = Int(age.truncatingRemainder(dividingBy: 3600) / 60)
    return m == 0 ? "\(h) h ago" : "\(h) h \(m) m ago"
  }
  return "\(Int(age / 86400)) d ago"
}

private func isStale(_ entry: TelemetryEntry) -> Bool {
  guard entry.producedAt > 0 else { return true }
  return entry.date.timeIntervalSince1970 - entry.producedAt / 1000 > 2 * 3600
}

private func fmtTemp(_ v: Double) -> String { String(format: "%.1f", v) }
private func fmtPct(_ v: Double) -> String { String(format: "%.0f", v) }
private func fmtLoad(_ v: Double) -> String { String(format: "%.2f", v) }
private func fmtBps(_ v: Double) -> String {
  if v >= 1_000_000 { return String(format: "%.1f MB/s", v / 1_000_000) }
  if v >= 1_000 { return String(format: "%.0f KB/s", v / 1_000) }
  return String(format: "%.0f B/s", v)
}
private func fmtUptime(_ s: Double) -> String {
  let d = Int(s) / 86400
  let h = (Int(s) % 86400) / 3600
  return d > 0 ? "\(d)d \(h)h" : "\(h)h"
}

// MARK: - Colors

private extension Color {
  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255)
  }
}

private struct BloomBackground: View {
  var body: some View {
    ZStack {
      Color(hex: 0x0B0F12)
      RadialGradient(colors: [Color(hex: 0x8B5CF6).opacity(0.75), .clear],
                     center: .topLeading, startRadius: 0, endRadius: 190)
      RadialGradient(colors: [Color(hex: 0xD946EF).opacity(0.45), .clear],
                     center: .bottomTrailing, startRadius: 0, endRadius: 170)
    }
  }
}

// MARK: - Sparkline

private struct Sparkline: View {
  let points: [SeriesPoint]
  var color: Color = .white
  var lineWidth: CGFloat = 2

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let h = geo.size.height
      let vs = points.map(\.v)
      let minV = vs.min() ?? 0
      let maxV = vs.max() ?? 1
      let span = max(maxV - minV, 1)
      let count = max(points.count - 1, 1)
      var path = Path()
      for (i, p) in points.enumerated() {
        let x = CGFloat(i) / CGFloat(count) * w
        let y = h - CGFloat((p.v - minV) / span) * h
        if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
        else { path.addLine(to: CGPoint(x: x, y: y)) }
      }
      return path.stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
    }
  }
}

// MARK: - Home Screen · Small

private struct SmallView: View {
  let entry: TelemetryEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Circle().fill(entry.isOnline ? Color(hex: 0x3CC06F) : Color(hex: 0x7A8A94)).frame(width: 6, height: 6)
        Text(entry.agentName).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.75))
          .lineLimit(1)
      }
      Spacer()
      if entry.hasData, let t = entry.value("cpu.temp_c") {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
          Text(fmtTemp(t)).font(.system(size: 24, weight: .semibold, design: .monospaced)).foregroundStyle(.white)
          Text("°C").font(.system(size: 11, weight: .bold)).foregroundStyle(.white.opacity(0.55))
        }
        Text("SOC TEMP").font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.55))
          .tracking(0.7)
        Sparkline(points: entry.points("cpu.temp_c"), color: Color(hex: 0x2FBCCF))
          .frame(height: 24)
      } else {
        Text(entry.isOnline ? "No data" : "Offline")
          .font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
        Text("Open the app").font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
      }
      Text(ageText(entry)).font(.system(size: 10, weight: .semibold)).foregroundStyle(.white.opacity(0.55))
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// MARK: - Home Screen · Medium

private struct MediumView: View {
  let entry: TelemetryEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 6) {
        Circle().fill(entry.isOnline ? Color(hex: 0x3CC06F) : Color(hex: 0x7A8A94)).frame(width: 6, height: 6)
        Text(entry.agentName).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
        Spacer()
        Text(entry.isOnline ? "DIRECT · \(Int(entry.rttMs))ms" : "OFFLINE")
          .font(.system(size: 10, weight: .bold)).foregroundStyle(.white.opacity(0.6))
        Text(ageText(entry)).font(.system(size: 10, weight: .semibold)).foregroundStyle(.white.opacity(0.55))
      }
      HStack(spacing: 8) {
        metric("CPU", entry.value("cpu.util_pct").map { "\(fmtPct($0))%" } ?? "—")
        metric("SOC TEMP", entry.value("cpu.temp_c").map { "\(fmtTemp($0))°" } ?? "—")
        metric("MEMORY", entry.value("mem.used_pct").map { "\(fmtPct($0))%" } ?? "—")
        metric("DISK", entry.value("disk.used_pct").map { "\(fmtPct($0))%" } ?? "—")
      }
      Spacer()
      if let cpu = entry.value("cpu.util_pct") {
        Sparkline(points: entry.points("cpu.util_pct")).frame(height: 28)
      }
    }
    .padding(14)
  }

  private func metric(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.55)).tracking(0.6)
      Text(value).font(.system(size: 17, weight: .semibold, design: .monospaced)).foregroundStyle(.white)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Lock Screen · Circular

private struct CircularView: View {
  let entry: TelemetryEntry
  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      if let t = entry.value("cpu.temp_c"), entry.hasData {
        let pct = CGFloat(min(max((t - 35) / 50, 0), 1))
        Circle().trim(from: 0.12, to: 0.88)
          .stroke(Color.white.opacity(0.25), style: StrokeStyle(lineWidth: 5, lineCap: .round))
        Circle().trim(from: 0.12, to: 0.12 + 0.76 * pct)
          .stroke(Color.white, style: StrokeStyle(lineWidth: 5, lineCap: .round))
          .rotationEffect(.degrees(90))
        VStack(spacing: 0) {
          Text("\(Int(t))").font(.system(size: 15, weight: .bold, design: .monospaced))
          Text("°C").font(.system(size: 8, weight: .bold))
        }
      } else {
        Image(systemName: entry.isOnline ? "cpu" : "wifi.slash")
          .font(.system(size: 16, weight: .semibold))
      }
    }
  }
}

// MARK: - Lock Screen · Rectangular

private struct RectangularView: View {
  let entry: TelemetryEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 4) {
        Circle().fill(entry.isOnline ? Color.white : Color.white.opacity(0.4)).frame(width: 6, height: 6)
        Text(entry.agentName).font(.system(size: 11, weight: .semibold)).lineLimit(1)
        Spacer()
        Text(ageText(entry)).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
      }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        if let t = entry.value("cpu.temp_c") {
          Text("\(fmtTemp(t)) °C").font(.system(size: 17, weight: .semibold, design: .monospaced))
        }
        if let c = entry.value("cpu.util_pct") {
          Text("CPU \(fmtPct(c)) %").font(.system(size: 15, weight: .semibold, design: .monospaced)).foregroundStyle(.secondary)
        }
      }
      if !entry.points("cpu.temp_c").isEmpty {
        Sparkline(points: entry.points("cpu.temp_c")).frame(height: 16)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Lock Screen · Inline

private struct InlineView: View {
  let entry: TelemetryEntry
  var body: some View {
    if entry.hasData {
      let t = entry.value("cpu.temp_c").map { "\(fmtTemp($0))°C" } ?? "—"
      let c = entry.value("cpu.util_pct").map { "\(fmtPct($0))%" } ?? "—"
      Text("\(Image(systemName: entry.isOnline ? "cpu" : "wifi.slash")) \(entry.agentName) · \(t) · \(c)")
    } else {
      Text("\(Image(systemName: "cpu")) \(entry.agentName)")
    }
  }
}

// MARK: - Entry view

// Tapping a metrics widget opens the Monitor page.
private let homeURL = URL(string: "pimon://dashboard")!

struct PiTelemetryEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TelemetryEntry

  var body: some View {
    switch family {
    case .systemMedium:
      MediumView(entry: entry).containerBackground(for: .widget) { BloomBackground() }.widgetURL(homeURL)
    case .accessoryCircular:
      CircularView(entry: entry).containerBackground(for: .widget) { Color.clear }.widgetURL(homeURL)
    case .accessoryRectangular:
      RectangularView(entry: entry).containerBackground(for: .widget) { Color.clear }.widgetURL(homeURL)
    case .accessoryInline:
      InlineView(entry: entry).containerBackground(for: .widget) { Color.clear }.widgetURL(homeURL)
    default:
      SmallView(entry: entry).containerBackground(for: .widget) { BloomBackground() }.widgetURL(homeURL)
    }
  }
}

// MARK: - Widget

struct PiTelemetryWidget: Widget {
  let kind = "PiTelemetry"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      PiTelemetryEntryView(entry: entry)
    }
    .configurationDisplayName("Raspberry Pi")
    .description("Live metrics from your Pi — temperature, CPU, memory and more, aged honestly.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

@main
struct RaspberryWidgetBundle: WidgetBundle {
  var body: some Widget {
    PiTelemetryWidget()
  }
}
