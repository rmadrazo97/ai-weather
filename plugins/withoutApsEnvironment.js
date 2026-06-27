// Local config plugin: remove the `aps-environment` entitlement.
//
// expo-notifications auto-injects `aps-environment` (Push Notifications / APNs),
// but this app uses LOCAL notifications only — no remote push — so the entitlement
// is unnecessary and makes code signing fail ("profile doesn't include Push
// Notifications"). Listed LAST in app.json plugins so its entitlements mod runs
// after expo-notifications' and deletes the key.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
