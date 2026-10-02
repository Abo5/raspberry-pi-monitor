// Reads and writes cookies in WKWebsiteDataStore.default() — the same persistent
// store react-native-webview uses — so the app can keep the user's Raspberry Pi
// Connect session between launches.
import ExpoModulesCore
import WebKit

public class ConnectCookiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ConnectCookies")

    // All cookies whose domain ends with `domain` (e.g. "connect.raspberrypi.com").
    AsyncFunction("getAll") { (domain: String, promise: Promise) in
      DispatchQueue.main.async {
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
          let list: [[String: Any]] = cookies
            .filter { $0.domain.hasSuffix(domain) }
            .map { c in
              [
                "name": c.name,
                "value": c.value,
                "domain": c.domain,
                "path": c.path,
                "secure": c.isSecure,
                "httpOnly": c.isHTTPOnly,
              ]
            }
          promise.resolve(list)
        }
      }
    }

    // Store a cookie, persisted until `expiresMs` (ms since epoch).
    AsyncFunction("set") { (cookie: [String: Any], expiresMs: Double, promise: Promise) in
      var props: [HTTPCookiePropertyKey: Any] = [
        .name: cookie["name"] as? String ?? "",
        .value: cookie["value"] as? String ?? "",
        .domain: cookie["domain"] as? String ?? "",
        .path: cookie["path"] as? String ?? "/",
        .expires: Date(timeIntervalSince1970: expiresMs / 1000),
      ]
      if (cookie["secure"] as? Bool) == true { props[.secure] = "TRUE" }
      if (cookie["httpOnly"] as? Bool) == true { props[HTTPCookiePropertyKey("HttpOnly")] = "TRUE" }
      guard let c = HTTPCookie(properties: props) else {
        promise.resolve(false)
        return
      }
      DispatchQueue.main.async {
        WKWebsiteDataStore.default().httpCookieStore.setCookie(c) { promise.resolve(true) }
      }
    }

    // Delete every cookie whose domain ends with `domain`, plus that site's other
    // website data (storage, caches). Also clears the app's shared
    // HTTPCookieStorage: react-native-webview (sharedCookiesEnabled) copies it
    // back into WebKit on the next load, which would quietly restore the session.
    AsyncFunction("clear") { (domain: String, promise: Promise) in
      DispatchQueue.main.async {
        let shared = HTTPCookieStorage.shared
        (shared.cookies ?? []).filter { $0.domain.hasSuffix(domain) }.forEach { shared.deleteCookie($0) }

        let dataStore = WKWebsiteDataStore.default()
        let store = dataStore.httpCookieStore
        let group = DispatchGroup()
        var count = 0
        group.enter()
        store.getAllCookies { cookies in
          let matching = cookies.filter { $0.domain.hasSuffix(domain) }
          count = matching.count
          for c in matching {
            group.enter()
            store.delete(c) { group.leave() }
          }
          group.leave()
        }
        group.enter()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.fetchDataRecords(ofTypes: types) { records in
          let matching = records.filter { $0.displayName.hasSuffix(domain) }
          dataStore.removeData(ofTypes: types, for: matching) { group.leave() }
        }
        group.notify(queue: .main) { promise.resolve(count) }
      }
    }
  }
}
