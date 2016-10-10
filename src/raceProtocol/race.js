'use strict';

const EventEmitter = require('voltrevo-event-emitter');
const sha256 = require('sha256');

function negotiateSeeds(transportQueue) {
  return Promise.resolve()
    .then(() => {
      const rand = sha256(String(Math.random()));
      const hashRand = sha256(rand);

      transportQueue.push(hashRand);

      return transportQueue.pop()
        .then(otherHashRand => ({otherHashRand, rand, hashRand}))
      ;
    })
    .then(({otherHashRand, rand}) => {
      transportQueue.push(rand);

      return transportQueue.pop()
        .then(otherRand => {
          if (sha256(otherRand) !== otherHashRand) {
            throw new Error(`sha256('${otherRand}') !== ${otherHashRand}`);
          }

          return {otherRand, rand};
        })
      ;
    })
    .then(({otherRand, rand}) => {
      const coRand = sha256([otherRand, rand].sort().join(''));
      return {coRand, otherRand, rand};
    })
  ;
}

function hashRandToNum(hashRand) {
  let sum = 0;
  let mul = 1;
  const digits = '0123456789abcdef';

  for (let i = 0; i !== hashRand.length; i++) {
    mul /= 16;
    sum += mul * digits.indexOf(hashRand[i]);
  }

  return sum;
}

function roundTrip(transportQueue) {
  const start = Date.now();
  transportQueue.push('');

  return transportQueue.pop()
    .then(() => Date.now() - start)
  ;
}

function calculateFirst({coRand, otherRand, rand}) {
  const coRandSmall = hashRandToNum(coRand) < 0.5;
  const randSmall = rand < otherRand;

  return (coRandSmall ^ randSmall) === 1;
}

function negotiatePeriod({transportQueue, seeds}) {
  const first = calculateFirst(seeds);

  const start = (first ?
    roundTrip(transportQueue) :
    transportQueue.pop().then(() => roundTrip(transportQueue))
  );

  const roundTrips = [start];

  // for (let i = 1; i !== 10; i++) {
  //   const last = roundTrips[roundTrips.length - 1];
  //   roundTrips.push(last.then(() => roundTrip(transportQueue)));
  // }

  return Promise.all(roundTrips)
    .then(roundTripResults => {
      if (first) {
        transportQueue.push();
      }

      const average = (
        roundTripResults.reduce((x, y) => x + y) /
        roundTripResults.length
      );

      transportQueue.push(String(average));

      return transportQueue.pop()
        .then((otherAverageStr) => {
          const otherAverage = Number(otherAverageStr);
          const period = 100 + 0.5 * (average + otherAverage);
          return period;
        })
      ;
    })
  ;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function solutionPhase({solver, transportQueue, seeds, period}) {
  const first = calculateFirst(seeds);
  const solveResult = solver.solve(seeds);

  let finished;

  solveResult.promise.then(solution => {
    finished = {solution};
  });

  let lastSent = 'not solved';
  let lastReceived = 'not solved';

  function waitTurn() {
    const next = new Promise((resolve, reject) => {
      transportQueue.pop().then(resolve);
      delay(3 * period).then(() => reject(new Error('timeout')));
    });

    return next.then(msg => delay(period).then(() => msg));
  }

  const loop = (msg) => {
    if (lastSent === 'not solved' && lastReceived === 'not solved') {
      lastReceived = msg;
      lastSent = (finished ? 'solved' : 'not solved');
      transportQueue.push(lastSent);
      return waitTurn().then(loop);
    }

    if (!finished) {
      solveResult.cancel();
    }

    if (lastSent === 'solved' && lastReceived === 'not solved') {
      transportQueue.push(finished.solution);
      return 'win';
    }

    if (lastSent === 'not solved' && lastReceived === 'solved') {
      if (!solver.validate(msg)) {
        throw new Error(`Rejected solution: ${JSON.stringify({msg, seeds})}`);
      }

      return 'lose';
    }

    if (lastSent === 'solved' && lastReceived === 'solved') {
      if (!solver.validate(msg)) {
        throw new Error(`Rejected solution: ${JSON.stringify({msg, seeds})}`);
      }

      return 'draw';
    }

    throw new Error('Shouldn\'t reach here');
  };

  if (first) {
    return delay(period).then(() => loop('not solved'));
  }

  return waitTurn().then(loop);
}

function AsyncQueue() {
  const queue = {};

  const dataBuf = [];
  const promiseBuf = [];

  function flush() {
    while (dataBuf.length > 0 && promiseBuf.length > 0) {
      promiseBuf.shift().resolve(dataBuf.shift());
    }
  }

  queue.push = x => {
    dataBuf.push(x);
    flush();
  };

  queue.pop = () => new Promise((resolve, reject) => {
    promiseBuf.push({resolve, reject});
    flush();
  });

  queue.clear = () => {
    while (promiseBuf.length > 0) {
      promiseBuf.shift().reject(new Error('Queue ended'));
    }

    while (dataBuf.length > 0) {
      dataBuf.shift();
    }
  };

  return queue;
}

function TransportQueue(transport) {
  const transportQueue = {};

  const queue = AsyncQueue();

  transport.events.on('message', msg => queue.push(msg));

  transportQueue.pop = () => queue.pop();
  transportQueue.push = msg => transport.send(msg);

  transportQueue.events = EventEmitter();

  transportQueue.log = transport.log;

  transport.events.on('close', () => {
    queue.clear();
    transportQueue.events.emit('close');
  });

  transportQueue.close = transport.close;

  return transportQueue;
}

// 1. Negotiate problem definition
  // negotiate seed
    // send hash(rand)
    // receive hash(rand)
    // send rand
    // receive rand
    // crand = hash(rand, rand)
    // crand < 0.5 means lower rand goes first
// 2. Negotiate message frequency
// 3. Solve the problem
  // Sending messages back and forth as quick as possible
  // Each time either send 'solved:hash' or 'not solved'
  // 'solved:hash' is followed by solution detail
  // Consecutive 'solved:hash' messages means a draw
  // Taking too long causes abort - possible manipulation
module.exports = (transport, solver) => {
  const transportQueue = TransportQueue(transport);

  return negotiateSeeds(transportQueue)
    .then(seeds => negotiatePeriod({transportQueue, seeds})
      .then(period => solutionPhase({solver, transportQueue, seeds, period}))
    )
    .catch(err => {
      transportQueue.push(`Error: ${err.message}`);
      transportQueue.close();
      throw err;
    })
  ;
};
