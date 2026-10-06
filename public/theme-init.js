// Runs before the app loads (a plain file: the site's CSP blocks inline scripts) so the page is
// painted in the right theme straight away, with no dark flash for light-mode users. ThemeService
// takes over once Angular starts; both read the same 'redline-theme' key: 'light', 'dark', or
// absent for System.
(function () {
  var mode = null;
  try {
    mode = localStorage.getItem('redline-theme');
  } catch (e) {}
  var prefersLight = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  var dark = mode === 'dark' || (mode !== 'light' && !prefersLight);
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
})();
