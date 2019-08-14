const { AddonTestUtils } = ChromeUtils.import(
  "resource://testing-common/AddonTestUtils.jsm"
);

AddonTestUtils.initMochitest(this);

add_task(async _ => {
  Services.prefs.setBoolPref("network.dns.native-is-localhost", true);

  info("Let's install the extension");
  let tmpFile = Services.dirsvc.QueryInterface(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
  tmpFile.append("secure-proxy-test.xpi");
  ok(tmpFile.exists, "The XPI exists");

  const extension = await AddonManager.installTemporaryAddon(tmpFile);
  is(extension.aboutURL, null, "No aboutURL set");
  is(extension.optionsURL, null, "No optionsURL set");
  is(extension.optionsType, null, "No optionsType set");
  ok(extension.incognito, "We want incognito support!");
  console.log(await extension.getBlocklistURL());
  is(extension.iconURL, "jar:file:///tmp/secure-proxy-test.xpi!/img/icon.svg", "Correct image");
  is(extension.icons["48"], "jar:file:///tmp/secure-proxy-test.xpi!/img/icon.svg", "48 icon");
  is(extension.icons["96"], "jar:file:///tmp/secure-proxy-test.xpi!/img/icon.svg", "96 icon");
  is(extension.screenshots, null, "no Screenshots");
  is(extension.isRecommended, false, "Not reccomended yet");
  ok(extension.isDebuggable, "Yes, debuggable!");
  ok(extension.isActive, "Active!");
  is(extension.userPermissions.origins.length, 1, "We want all the URLs!");
  is(extension.userPermissions.origins[0], "<all_urls>", "We want all the URLs!");

  
  const permissions = ["identity","proxy","storage","tabs","webRequest","webRequestBlocking"];
  is(extension.userPermissions.permissions.length, permissions.length, "Our permissions");
  permissions.forEach(p => {
    ok(extension.userPermissions.permissions.includes(p), "Permission: " + p);
  });

  await extension.uninstall();
  info("Addon uninstalled");
});
