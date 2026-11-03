(function () {
  function fetchJson(url, options) {
    return fetch(url, Object.assign({
      headers: { Accept: 'application/json' }
    }, options || {})).then((response) => {
      return response.json().then((data) => {
        if (!response.ok) {
          const message = data && data.error ? data.error : 'Request failed';
          throw new Error(message);
        }
        return data;
      });
    });
  }

  window.FP = window.FP || {};
  window.FP.api = {
    loadTables: function () {
      return fetchJson(window.FP.config.apiTablesUrl);
    },
    loadTable: function (tableName) {
      const url = window.FP.config.apiTableUrlTemplate.replace('__TABLE__', encodeURIComponent(tableName));
      return fetchJson(url);
    }
  };
})();
