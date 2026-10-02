// A small SSH client for the Monitor page: connect with a username + password and
// run read-only commands (reading /proc, /sys, df …) to collect the Pi's metrics.
// Host keys are trust-on-first-use: the first key seen is returned to JS to be
// saved, and later connections must present the same key.
import ExpoModulesCore
import Citadel
import NIO
import NIOSSH

final class SshException: GenericException<String> {
  override var reason: String { param }
}

/// Accepts the key if it matches the one saved earlier (or none is saved yet),
/// and records what the server presented.
final class TofuHostKeyValidator: NIOSSHClientServerAuthenticationDelegate, @unchecked Sendable {
  private let expected: String?
  private(set) var presented: String?

  init(expected: String?) {
    self.expected = (expected?.isEmpty ?? true) ? nil : expected
  }

  func validateHostKey(hostKey: NIOSSHPublicKey, validationCompletePromise: EventLoopPromise<Void>) {
    let key = String(openSSHPublicKey: hostKey)
    presented = key
    if let expected, expected != key {
      validationCompletePromise.fail(SshException("HOST_KEY_CHANGED"))
    } else {
      validationCompletePromise.succeed(())
    }
  }
}

actor SshClients {
  private var clients: [String: SSHClient] = [:]
  func put(_ id: String, _ client: SSHClient) { clients[id] = client }
  func get(_ id: String) -> SSHClient? { clients[id] }
  func remove(_ id: String) -> SSHClient? { clients.removeValue(forKey: id) }
}

public class PiSshModule: Module {
  private let clients = SshClients()

  public func definition() -> ModuleDefinition {
    Name("PiSsh")

    AsyncFunction("connect") { (host: String, port: Int, username: String, password: String, expectedHostKey: String?) async throws -> [String: String] in
      let validator = TofuHostKeyValidator(expected: expectedHostKey)
      let client: SSHClient
      do {
        client = try await SSHClient.connect(
          host: host,
          port: port,
          authenticationMethod: .passwordBased(username: username, password: password),
          hostKeyValidator: .custom(validator),
          reconnect: .never,
          connectTimeout: .seconds(10)
        )
      } catch let e as SshException {
        throw e
      } catch {
        throw SshException(String(describing: error))
      }
      let id = UUID().uuidString
      await clients.put(id, client)
      return ["id": id, "hostKey": validator.presented ?? ""]
    }

    AsyncFunction("exec") { (id: String, command: String) async throws -> String in
      guard let client = await clients.get(id) else { throw SshException("NOT_CONNECTED") }
      do {
        let out = try await client.executeCommand(command, maxResponseSize: 1 << 20)
        return String(buffer: out)
      } catch {
        throw SshException(String(describing: error))
      }
    }

    AsyncFunction("disconnect") { (id: String) async in
      if let client = await clients.remove(id) {
        try? await client.close()
      }
    }
  }
}
