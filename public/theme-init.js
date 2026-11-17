// Runs before the app loads (a plain file: the site's CSP blocks inline scripts) so the page is
// painted in the saved look straight away, with no flash of the wrong one. ThemeService and
// UiPrefsService take over once Angular starts; they read the same keys.
//   redline-theme    'light' | 'dark' | 'system'   (absent = dark, Redline's own look)
//   redline-colour   {fill, light, dark} hex        (absent = Redline red; written by app-colour.ts)
//   redline-density  'compact'                      (absent = comfortable)
//   redline-motion   'reduce'                       (absent = normal)
(function () {
  var get = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  var root = document.documentElement;

  var mode = get('redline-theme');
  var prefersLight = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  var light = mode === 'light' || (mode === 'system' && prefersLight);
  root.classList.toggle('dark', !light);
  root.classList.toggle('light', light);

  try {
    var colour = JSON.parse(get('redline-colour') || 'null');
    if (colour && /^#[0-9a-f]{6}$/i.test(colour.fill)) {
      root.style.setProperty('--acc-fill', colour.fill);
      root.style.setProperty('--acc-on', '#ffffff');
      root.style.setProperty('--acc-ink-light', colour.light);
      root.style.setProperty('--acc-ink-dark', colour.dark);
    }
  } catch (e) {}
  if (get('redline-density') === 'compact') root.classList.add('density-compact');
  if (get('redline-motion') === 'reduce') root.classList.add('reduce-motion');
})();
