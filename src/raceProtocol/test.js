'use strict';

const test = require('tape');

const TransportPair = require('./TransportPair.js');
// const race = require('./race.js');

test('can send message', t => {
  t.plan(1);

  const [a, b] = TransportPair();

  a.send('foo');

  b.events.on('message', msg => {
    t.equal(msg, 'foo');
  });
});
