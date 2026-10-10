(async function () {
  const countsMap = {};
  const fetchingIds = new Set();

  const apiElement = document.querySelector(
    '[data-reedito-comments-counts-api], [data-ghost-comments-counts-api]',
  );
  if (!apiElement) {
    return;
  }
  const api = apiElement.dataset.reeditoCommentsCountsApi || apiElement.dataset.ghostCommentsCountsApi;

  const debounce = function (func, timeout = 100) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  };

  const addIdsFromElement = function (node) {
    const countElems =
      node.querySelectorAll?.('[data-reedito-comment-count], [data-ghost-comment-count]') || [];

    countElems.forEach((countElem) => {
      const id = countElem.dataset.reeditoCommentCount || countElem.dataset.ghostCommentCount;
      if (!countsMap[id]) {
        fetchingIds.add(id);
      }
    });
  };

  const renderCounts = function () {
    for (const [id, count] of Object.entries(countsMap)) {
      const countElems = document.querySelectorAll(
        `[data-reedito-comment-count="${id}"], [data-ghost-comment-count="${id}"]`,
      );
      countElems.forEach((e) => {
        const empty = e.dataset.reeditoCommentCountEmpty || e.dataset.ghostCommentCountEmpty;
        const singular = e.dataset.reeditoCommentCountSingular || e.dataset.ghostCommentCountSingular;
        const plural = e.dataset.reeditoCommentCountPlural || e.dataset.ghostCommentCountPlural;
        let text = empty;
        if (count === 1) {
          if (singular) {
            text = `${count} ${singular}`;
          } else {
            text = count;
          }
        }
        if (count > 1) {
          if (plural) {
            text = `${count} ${plural}`;
          } else {
            text = count;
          }
        }
        if (text) {
          if (e.dataset.reeditoCommentCountAutowrap !== 'false') {
            const el = document.createElement(e.dataset.reeditoCommentCountTag);
            if (e.dataset.reeditoCommentCountClassName) {
              el.classList.add(e.dataset.reeditoCommentCountClassName);
            }
            el.textContent = text;
            e.insertAdjacentElement('afterend', el);
          } else {
            e.insertAdjacentText('afterend', text);
          }
        }
        e.remove();
      });
    }
  };

  const fetchCounts = async function () {
    const ids = Array.from(fetchingIds);
    fetchingIds.clear();

    if (!ids.length) {
      return;
    }

    const rawRes = await fetch(`${api}?ids=${ids.join(',')}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (rawRes.status !== 200) {
      return;
    }

    const res = await rawRes.json();

    for (const [id, count] of Object.entries(res)) {
      countsMap[id] = count;
    }

    renderCounts();
  };

  const debouncedFetchCounts = debounce(fetchCounts);

  const countElemObserver = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      mutation.addedNodes.forEach((addedNode) => {
        addIdsFromElement(addedNode);
      });
    });
    debouncedFetchCounts();
  });

  countElemObserver.observe(document.body, { subtree: true, childList: true });

  addIdsFromElement(document.body);
  fetchCounts();
})();
