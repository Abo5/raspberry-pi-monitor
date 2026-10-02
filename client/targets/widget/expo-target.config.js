/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'RaspberryWidget',
  displayName: 'Raspberry Pi',
  deploymentTarget: '17.0',
  icon: '../../assets/icon.png',
  colors: {
    $widgetBackground: '#0B0F12',
    $accent: '#8A6BEA',
  },
  // Same App Group as the app: the app writes the account's devices there.
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
