// Тема применяется до первой отрисовки — иначе при тёмной теме
// страница успевает мигнуть светлым фоном.
(function () {
  try {
    var stored = localStorage.getItem('ih-theme');
    var dark = stored ? stored === 'dark' : true;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* приватный режим — остаёмся на тёмной теме по умолчанию */
  }
})();
