(function () {
  function ensureAudioElement() {
    let element = document.getElementById('fp-audio-player');
    if (!element) {
      element = document.createElement('audio');
      element.id = 'fp-audio-player';
      element.preload = 'auto';
      element.setAttribute('playsinline', 'true');
      document.body.appendChild(element);
    }
    return element;
  }

  function resolveOnEnd(audio) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      audio.onended = finish;
      audio.onerror = finish;
    });
  }

  window.FP = window.FP || {};
  window.FP.audio = {
    playOnce: function (url) {
      const audio = ensureAudioElement();
      if (window.FP.muted) {
        audio.muted = true;
      } else {
        audio.muted = false;
      }
      audio.pause();
      audio.src = url;
      audio.load();
      return new Promise((resolve) => {
        const wrapped = resolveOnEnd(audio);
        audio.play().catch(() => {
          resolve();
        });
        wrapped.then(resolve);
      });
    }
  };
})();
