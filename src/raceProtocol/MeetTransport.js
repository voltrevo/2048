'use strict';

const once = require('lodash/once');
const sha256 = require('sha256');

function loadScript(src) {
  const script = document.createElement('script');
  script.src = src;
  document.body.appendChild(script);

  return new Promise(resolve =>
    script.addEventListener('load', resolve)
  );
}

const loadOpentok = once(() => loadScript('https://static.opentok.com/v2/js/opentok.js')
  .then(() => window.OT)
);

module.exports = (id) => {
  const hashId = sha256(`2048-challenge-${id}`);

  return Promise
    .all([
      loadOpentok(),
      fetch(`https://meet.tokbox.com/${hashId}`),
    ])
    .then(([ot, {apiKey, sessionId, token}]) => new Promise((resolve, reject) => {
      const session = ot.initSession(apiKey, sessionId);

      session.connect(token, (err) => {
        if (err) {
          reject(err);
        }

        const transport = {};

        let peerId = null;

        transport.send = msg => {
          session.signal({data: msg});
        };

        session.on('signal', event => {
          if (peerId === null) {
            peerId = event.from.id;
          } else if (peerId !== event.from.id) {
            return;
          }

          transport.events.emit('message', event.data);
        });

        resolve(transport);
      });
    }))
  ;
};
