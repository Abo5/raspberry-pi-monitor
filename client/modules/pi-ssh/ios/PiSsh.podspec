Pod::Spec.new do |s|
  s.name           = 'PiSsh'
  s.version        = '1.0.0'
  s.summary        = 'Minimal SSH client (Citadel / SwiftNIO SSH) to run read-only commands on the Pi.'
  s.author         = ''
  s.homepage       = 'https://github.com/Abo5/raspberry-pi-monitor'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  # Citadel is distributed only via Swift Package Manager. 0.11.x supports iOS 14+
  # (0.12 requires iOS 17). React Native's helper wires the package into the Pods
  # project during post_install.
  spm_dependency(s,
    url: 'https://github.com/orlandos-nl/Citadel.git',
    requirement: { kind: 'exactVersion', version: '0.11.1' },
    products: ['Citadel']
  )

  s.source_files = '**/*.{h,m,swift}'
end
