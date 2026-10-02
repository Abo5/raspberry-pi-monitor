Pod::Spec.new do |s|
  s.name           = 'ConnectCookies'
  s.version        = '1.0.0'
  s.summary        = 'Read/write cookies in the app WKWebView store (Raspberry Pi Connect session).'
  s.author         = ''
  s.homepage       = 'https://github.com/Abo5/raspberry-pi-monitor'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end
