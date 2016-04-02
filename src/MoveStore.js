const assert = require('assert');

const memoize = require('lodash.memoize');

const urlRegex = /(2048|https?):\/\/[^;]+$/;

const localObjects = {
  '': '',
};

const fetchText = memoize((url) => (
  url in localObjects ?
    Promise.resolve(localObjects[url]) :
    fetch(`https://crossorigin.me/${url}`).then(res => res.text())
));

const MoveStore = (moves) => {
  const moveStore = {};

  const data = {};

  moveStore.set = (moveString = '') => {
    if (urlRegex.test(moveString)) {
      data.remote = moveString;
      data.shortenRemote = 0;
      data.append = '';
    } else if (moveString.split(';').length === 3) {
      const parts = moveString.split(';');
      data.remote = parts[0];
      data.shortenRemote = Number(parts[1]);
      data.append = parts[2];
    } else {
      data.remote = '';
      data.shortenRemote = 0;
      data.append = moveString;
    }

    assert(data.remote === '' || urlRegex.test(data.remote));
    assert(typeof data.shortenRemote === 'number');
    assert(data.shortenRemote === data.shortenRemote); // ie not NaN
    assert(/[lrud]*/.test(data.append));
  };

  moveStore.set(moves);

  moveStore.get = () => {
    if (data.remote === '') {
      return data.append;
    }

    if (data.append === '' && data.shortenRemote === 0) {
      return data.remote;
    }

    return [data.remote, data.shortenRemote, data.append].join(';');
  };

  moveStore.shorten = (n) => {
    const appendShortenLen = Math.min(data.append.length, n);
    data.append = data.append.substring(0, data.append.length - appendShortenLen);

    data.shortenRemote += (n - appendShortenLen);
  };

  moveStore.append = (str) => data.append += str;

  moveStore.resolve = () => (
    fetchText(data.remote).then(remoteText => (
      remoteText.substring(0, remoteText.length - data.shortenRemote)
    )).then(shortenedRemoteText =>
      shortenedRemoteText + data.append
    )
  );

  return moveStore;
};

module.exports = MoveStore;
