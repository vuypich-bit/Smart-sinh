if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    // ចុះឈ្មោះឯកសារ sw.js
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
      console.log('PWA Register: SW registration successful.');
    }).catch(function(err) {
      console.log('PWA Register: SW registration failed: ', err);
    });
  });
}
