(function () {
  function youtubeOrigin() {
    return window.location.origin || 'https://example.com';
  }

  function buildIframeUrl(url) {
    const base = url.includes('?') ? `${url}&` : `${url}?`;
    return `${base}autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(youtubeOrigin())}`;
  }

  function appendTransitionGuard(videoWrapper, onComplete) {
    const guardKey = 'fp-video-transition-fired';
    if (videoWrapper.dataset[guardKey]) {
      return;
    }
    videoWrapper.dataset[guardKey] = 'true';
    const fallback = setTimeout(() => {
      onComplete();
    }, 30000);
    videoWrapper.__fpFallbackTimer = fallback;
    return fallback;
  }

  window.FP = window.FP || {};
  window.FP.video = {
    render: function (phase, onComplete, onError) {
      const container = document.getElementById('fp-video-stage');
      if (!container) {
        return;
      }
      container.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'fp-video-wrapper';

      if (phase && phase.videoUrl) {
        if (phase.videoUrl.indexOf('youtube.com/embed/') !== -1 || phase.videoUrl.indexOf('youtu.be/') !== -1) {
          const iframe = document.createElement('iframe');
          iframe.src = buildIframeUrl(phase.videoUrl);
          iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
          iframe.allowFullscreen = true;
          wrapper.appendChild(iframe);
          const finishHandler = () => {
            if (window.FP.state.video.transitionFired) {
              return;
            }
            window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
            onComplete && onComplete();
          };
          try {
            iframe.addEventListener('load', () => {
              window.FP.state.video.playing = true;
              appendTransitionGuard(wrapper, finishHandler);
            });
          } catch (err) {
            onError && onError(err);
          }
          const ytApiReady = (window.YT && window.YT.Player);
          if (ytApiReady) {
            // no-op; we rely on the iframe completion path.
          }
        } else {
          const video = document.createElement('video');
          video.autoplay = true;
          video.playsInline = true;
          video.controls = true;
          video.src = phase.videoUrl;
          video.addEventListener('ended', () => {
            if (window.FP.state.video.transitionFired) {
              return;
            }
            window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
            onComplete && onComplete();
          });
          video.addEventListener('error', () => {
            onError && onError(new Error('Video failed to load'));
          });
          wrapper.appendChild(video);
          appendTransitionGuard(wrapper, () => {
            if (window.FP.state.video.transitionFired) {
              return;
            }
            window.FP.state.dispatch({ type: 'VIDEO_FINISHED' });
            onComplete && onComplete();
          });
        }
      }

      container.appendChild(wrapper);
    }
  };
})();
