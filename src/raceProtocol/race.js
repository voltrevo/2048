'use strict';

const sha256 = require('sha256');

function nextMessage(transport) {
  return new Promise((resolve, reject) => {
    if (!transport.open) {
      reject();
      return;
    }

    transport.events.on('close', reject);

    transport.events.once('message', msg => {
      if (msg.slice(0, 6) === 'Error:') {
        reject(new Error(msg.slice(6)));
      } else {
        resolve(msg);
      }
    });
  });
}

function negotiateSeeds(transport) {
  return Promise.resolve()
    .then(() => {
      const rand = sha256(String(Math.random()));
      const hashRand = sha256(rand);

      transport.send(hashRand);

      return nextMessage(transport)
        .then(otherHashRand => ({otherHashRand, rand, hashRand}))
      ;
    })
    .then(({otherHashRand, rand}) => {
      transport.send(rand);

      return nextMessage(transport)
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
      return {transport, seeds: {coRand, otherRand, rand}};
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

function roundTrip(transport) {
  const start = Date.now();
  transport.send('');

  return nextMessage(transport)
    .then(() => Date.now() - start)
  ;
}

function calculateFirst({coRand, otherRand, rand}) {
  const coRandSmall = hashRandToNum(coRand) < 0.5;
  const randSmall = rand < otherRand;

  return (coRandSmall ^ randSmall) === 1;
}

function negotiatePeriod({transport, seeds}) {
  const first = calculateFirst(seeds);

  const start = (first ?
    roundTrip(transport) :
    nextMessage(transport).then(roundTrip)
  );

  const roundTrips = [start];

  for (let i = 1; i !== 10; i++) {
    const last = roundTrips[roundTrips.length - 1];
    roundTrips.push(last.then(() => roundTrip(transport)));
  }

  return Promise.all(roundTrips)
    .then(roundTripResults => {
      if (!first) {
        transport.send('');
      }

      const average = (
        roundTripResults.reduce((x, y) => x + y) /
        roundTripResults.length
      );

      transport.send(String(average));

      return nextMessage(transport)
        .then((otherAverageStr) => {
          const otherAverage = Number(otherAverageStr);
          const period = 100 + 0.5 * (average + otherAverage);
          return {transport, seeds, period};
        })
      ;
    })
  ;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function solutionPhase({solver, transport, seeds, period}) {
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
      nextMessage(transport).then(resolve);
      delay(3 * period).then(reject);
    });

    return next.then(msg => delay(period).then(() => msg));
  }

  const loop = (msg) => {
    if (lastSent === 'not solved' && lastReceived === 'not solved') {
      lastReceived = msg;
      lastSent = (finished ? 'solved' : 'not solved');
      transport.send(lastSent);
      return waitTurn().then(loop);
    }

    if (lastSent === 'solved' && lastReceived === 'not solved') {
      transport.send(finished.solution);
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
    return delay(period).then(loop);
  }

  return waitTurn().then(loop);
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
module.exports = (transport, solver) => negotiateSeeds(transport)
  .then(seeds => negotiatePeriod({transport, seeds})
    .then(period => solutionPhase({solver, transport, seeds, period}))
  )
  .catch(err => {
    transport.send(`Error: ${err.message}`);
    transport.close();
    throw err;
  })
;
