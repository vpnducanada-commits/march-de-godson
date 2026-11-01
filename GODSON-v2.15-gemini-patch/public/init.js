(function () {
  var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  var theme = 'light';
  try {
    var s = localStorage.getItem('gm:theme');
    theme =
      s === 'dark' || s === 'light'
        ? s
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.dataset.theme = theme;
  } catch (e) {}

  // Chargement asynchrone non-bloquant des polices Google Fonts (0 ms de blocage réseau sur 3G/4G)
  try {
    var fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap';
    document.head.appendChild(fl);
  } catch (e) {}

  var dismissed = false;
  window.__gmDismissSplash = function () {
    if (dismissed) return;
    var el = document.getElementById('gm-splash');
    if (!el) {
      dismissed = true;
      return;
    }
    var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    var elapsed = now - t0;
    var reduced = false;
    var warm = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      warm = sessionStorage.getItem('gm:booted') === '1';
      sessionStorage.setItem('gm:booted', '1');
    } catch (e) {}
    var minShow = reduced ? 0 : warm ? 150 : 720;
    var wait = Math.max(0, minShow - elapsed);
    dismissed = true;
    setTimeout(function () {
      el.classList.add('gm-splash--out');
      try {
        var m = document.querySelector('meta[name="theme-color"]');
        var cur = document.documentElement.dataset.theme || theme;
        if (m) m.setAttribute('content', cur === 'dark' ? '#0b1220' : '#0A1633');
      } catch (e) {}
      setTimeout(function () {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 360);
    }, wait);
  };

  // Garde-fou : ne bloque jamais l'accès au site même sur réseau instable
  setTimeout(function () {
    if (window.__gmDismissSplash) window.__gmDismissSplash();
  }, 2400);
})();
